// Calculs du pointage de quart (lib/quarts.js) : heures de présence payées,
// arrondi, comparaison avec le temps passé sur les bons, anomalies.
//
// Fonctions pures (aucune lecture en base) : testées par scripts/tester-quarts.js.
//
// Les heures gardées en base sont toujours celles du pointage réel. L'arrondi
// ne s'applique qu'ici, au calcul — on peut donc changer la règle sans rien
// perdre, et montrer les deux (pointé / payé) sur la feuille de temps.
const { dateQuebecStr } = require("./temps");

const TYPES_QUART = ["TRAVAIL", "DINER", "PAUSE"];
const LIBELLES_TYPE = { TRAVAIL: "Travail", DINER: "Dîner", PAUSE: "Pause" };
const ARRONDIS_OFFERTS = [0, 5, 6, 10, 15]; // minutes ; 0 = à la minute
const SEUIL_QUART_LONG_HEURES = 12;
const TOLERANCE_HORS_QUART_MS = 2 * 60000;

const REGLAGES_DEFAUT = {
  arrondiMinutes: 15,
  // Arrivée pointée avant l'ouverture du commerce : le temps payé part de
  // l'ouverture — ou du premier poinçon de tâche, s'il a commencé plus tôt.
  // Ne touche jamais un quart entré ou corrigé par le gérant.
  calerOuverture: true,
  dinerPaye: false,
};

const ms = (d) => new Date(d).getTime();
const heures = (millis) => millis / 3600000;
const arrondir2 = (h) => Math.round(h * 100) / 100;

// Au plus proche multiple de `minutes` — jamais toujours vers le bas ni
// toujours vers le haut : l'arrondi ne joue pas contre l'employé. (Les
// fuseaux du Québec sont à des heures entières d'UTC : arrondir l'instant
// arrondit aussi l'heure locale.)
function arrondirInstant(instant, minutes) {
  if (!(minutes > 0)) return ms(instant);
  const pas = minutes * 60000;
  return Math.round(ms(instant) / pas) * pas;
}

// Réunit des intervalles [debut, fin] (millisecondes) qui se chevauchent
function unir(intervalles) {
  const tries = intervalles.filter(([d, f]) => f > d).sort((a, b) => a[0] - b[0]);
  const resultat = [];
  for (const [d, f] of tries) {
    const dernier = resultat[resultat.length - 1];
    if (dernier && d <= dernier[1]) dernier[1] = Math.max(dernier[1], f);
    else resultat.push([d, f]);
  }
  return resultat;
}
const duree = (intervalles) => intervalles.reduce((s, [d, f]) => s + (f - d), 0);
// Partie de `intervalles` (réunis) qui n'est couverte par aucun de `couverture` (réunis)
function soustraire(intervalles, couverture) {
  const resultat = [];
  for (const [d, f] of intervalles) {
    let curseur = d;
    for (const [cd, cf] of couverture) {
      if (cf <= curseur || cd >= f) continue;
      if (cd > curseur) resultat.push([curseur, cd]);
      curseur = Math.max(curseur, cf);
    }
    if (curseur < f) resultat.push([curseur, f]);
  }
  return resultat;
}

/**
 * Feuille d'UN employé, jour par jour.
 *
 * `quarts` : ses quarts [{ id, type, debut, fin, ouvertAuto, fermeAuto, modifiePar, ajoutePar }].
 * `entreesBons`, `entreesInternes` : ses poinçons de tâche [{ debut, fin }].
 * `reglages` : { arrondiMinutes, calerOuverture, dinerPaye }.
 * `ouvertureDuJour(dateStr)` : instant d'ouverture du commerce ce jour-là, ou null (fermé).
 * `maintenant` : un quart encore ouvert AUJOURD'HUI compte jusqu'à maintenant ;
 *   ouvert depuis un autre jour, il ne compte pas (départ oublié, à corriger).
 *
 * Retourne Map "AAAA-MM-JJ" → {
 *   quarts: [{ ...quart, debutPaye, finPaye, heuresPayees }]  (TRAVAIL seulement),
 *   segments: [dîners et pauses du jour],
 *   presence (heures pointées, dîner compris), diner, pauses, payees,
 *   bons, internes, nonAttribue, efficacite (bons ÷ payées, ou null), enCours, anomalies: [{ code, texte, bloquante }]
 * }
 * Un quart appartient au jour (Québec) de son début.
 */
function calculerJours({ quarts, entreesBons = [], entreesInternes = [], reglages = REGLAGES_DEFAUT, ouvertureDuJour = () => null, maintenant = new Date() }) {
  const { arrondiMinutes, calerOuverture, dinerPaye } = { ...REGLAGES_DEFAUT, ...reglages };
  const aujourdhui = dateQuebecStr(maintenant);
  const maintenantMs = ms(maintenant);
  const jours = new Map();
  const jour = (dateStr) => {
    if (!jours.has(dateStr)) {
      jours.set(dateStr, { dateStr, quarts: [], segments: [], presence: 0, diner: 0, pauses: 0, payees: 0, bons: 0, internes: 0, nonAttribue: 0, efficacite: null, enCours: false, anomalies: [] });
    }
    return jours.get(dateStr);
  };
  const anomalie = (j, code, texte, bloquante = false) => j.anomalies.push({ code, texte, bloquante });

  // Fin retenue d'un intervalle : null s'il est ouvert depuis un autre jour
  const finDe = (e) => (e.fin ? ms(e.fin) : dateQuebecStr(e.debut) === aujourdhui ? maintenantMs : null);

  const travail = quarts.filter((q) => q.type === "TRAVAIL").sort((a, b) => ms(a.debut) - ms(b.debut));
  const coupures = quarts.filter((q) => q.type !== "TRAVAIL").sort((a, b) => ms(a.debut) - ms(b.debut));
  const taches = [...entreesBons.map((e) => ({ ...e, bon: true })), ...entreesInternes.map((e) => ({ ...e, bon: false }))];

  // Poinçons de tâche par jour : temps sur les bons, temps interne
  const tachesParJour = new Map();
  for (const t of taches) {
    const fin = finDe(t);
    if (fin == null) continue;
    const d = dateQuebecStr(t.debut);
    if (!tachesParJour.has(d)) tachesParJour.set(d, { bons: [], toutes: [] });
    const groupe = tachesParJour.get(d);
    groupe.toutes.push([ms(t.debut), fin]);
    if (t.bon) groupe.bons.push([ms(t.debut), fin]);
  }

  for (const q of travail) {
    const j = jour(dateQuebecStr(q.debut));
    const debut = ms(q.debut);
    const fin = finDe(q);
    if (!q.fin) {
      if (fin == null) anomalie(j, "DEPART_OUBLIE", "Départ non pointé : le quart est toujours ouvert.", true);
      else j.enCours = true;
    }
    if (q.fermeAuto) anomalie(j, "FERME_AUTO", "Départ non pointé : quart fermé à la fin du dernier poinçon de tâche. À vérifier.");
    if (fin == null) { j.quarts.push({ ...q, debutPaye: null, finPaye: null, heuresPayees: 0 }); continue; }
    if (heures(fin - debut) > SEUIL_QUART_LONG_HEURES) anomalie(j, "QUART_LONG", `Quart de plus de ${SEUIL_QUART_LONG_HEURES} heures.`);

    // Début et fin payés : arrondis, et calés sur l'ouverture au besoin
    let debutPaye = arrondirInstant(debut, arrondiMinutes);
    const corrige = !!(q.modifiePar || q.ajoutePar);
    const ouverture = ouvertureDuJour(j.dateStr);
    if (calerOuverture && !corrige && ouverture && debut < ms(ouverture)) {
      const premiereTache = taches
        .map((t) => ms(t.debut))
        .filter((d) => d >= debut && d < ms(ouverture))
        .sort((a, b) => a - b)[0];
      const depart = premiereTache != null ? arrondirInstant(premiereTache, arrondiMinutes) : ms(ouverture);
      debutPaye = Math.max(debutPaye, Math.min(depart, ms(ouverture)));
    }
    // Quart en cours : pas d'arrondi sur « maintenant »
    let finPaye = q.fin ? arrondirInstant(fin, arrondiMinutes) : fin;
    if (finPaye < debutPaye) finPaye = debutPaye;

    // Dîners (non payés, sauf réglage) et pauses (toujours payées) du quart
    const dedans = coupures.filter((c) => ms(c.debut) >= debut && ms(c.debut) <= fin);
    let dinerPayeMs = 0;
    for (const c of dedans) {
      const cFin = finDe(c) ?? fin;
      const brut = Math.max(0, Math.min(cFin, fin) - ms(c.debut));
      if (c.type === "DINER") {
        j.diner += heures(brut);
        const d = Math.max(debutPaye, arrondirInstant(c.debut, arrondiMinutes));
        const f = Math.min(finPaye, c.fin ? arrondirInstant(cFin, arrondiMinutes) : cFin);
        dinerPayeMs += Math.max(0, f - d);
      } else {
        j.pauses += heures(brut);
      }
    }
    const heuresPayees = Math.max(0, heures(finPaye - debutPaye - (dinerPaye ? 0 : dinerPayeMs)));
    j.presence += heures(fin - debut);
    j.payees += heuresPayees;
    j.quarts.push({ ...q, debutPaye: new Date(debutPaye), finPaye: new Date(finPaye), heuresPayees: arrondir2(heuresPayees) });
  }

  // Chevauchement de deux quarts de travail
  for (let i = 1; i < travail.length; i++) {
    const precedent = travail[i - 1];
    const finPrecedent = precedent.fin ? ms(precedent.fin) : Infinity;
    if (ms(travail[i].debut) < finPrecedent) {
      anomalie(jour(dateQuebecStr(travail[i].debut)), "CHEVAUCHEMENT", "Deux quarts se chevauchent.", true);
    }
  }

  // Dîners et pauses : rattachés à leur jour ; signalés hors d'un quart ou restés ouverts
  for (const c of coupures) {
    const j = jour(dateQuebecStr(c.debut));
    j.segments.push(c);
    const d = ms(c.debut);
    const dansUnQuart = travail.some((q) => d >= ms(q.debut) && d <= (q.fin ? ms(q.fin) : Infinity));
    const nom = LIBELLES_TYPE[c.type] || c.type;
    if (!dansUnQuart) anomalie(j, "COUPURE_HORS_QUART", `${nom} pointé en dehors d'un quart.`);
    if (!c.fin && j.dateStr !== aujourdhui) anomalie(j, "COUPURE_OUVERTE", `${nom} jamais terminé.`, true);
    if (c.fermeAuto) anomalie(j, "COUPURE_FERMEE_AUTO", `${nom} non terminé : fermé automatiquement. À vérifier.`);
  }

  // Temps sur les bons, temps interne, temps non attribué
  const quartsBruts = unir(travail.map((q) => [ms(q.debut), q.fin ? ms(q.fin) : maintenantMs]));
  for (const [dateStr, groupe] of tachesParJour) {
    const j = jour(dateStr);
    const bons = unir(groupe.bons);
    const toutes = unir(groupe.toutes);
    j.bons = heures(duree(bons));
    j.internes = heures(duree(toutes) - duree(bons));
    const horsQuart = duree(soustraire(toutes, quartsBruts));
    if (horsQuart > TOLERANCE_HORS_QUART_MS) {
      anomalie(j, "TACHE_HORS_QUART", j.quarts.length === 0 ? "Temps poinçonné sur des tâches, mais aucun quart ce jour-là." : "Temps poinçonné sur des tâches en dehors du quart.");
    }
  }

  for (const j of jours.values()) {
    for (const cle of ["presence", "diner", "pauses", "payees", "bons", "internes"]) j[cle] = arrondir2(j[cle]);
    j.nonAttribue = arrondir2(Math.max(0, j.payees - j.bons - j.internes));
    j.efficacite = j.payees > 0 ? j.bons / j.payees : null;
  }
  return jours;
}

// Totaux d'une liste de jours (résultats de calculerJours)
function totaliser(jours) {
  const t = { presence: 0, diner: 0, pauses: 0, payees: 0, bons: 0, internes: 0, nonAttribue: 0 };
  for (const j of jours) for (const cle of Object.keys(t)) t[cle] += j[cle];
  for (const cle of Object.keys(t)) t[cle] = arrondir2(t[cle]);
  return { ...t, efficacite: t.payees > 0 ? t.bons / t.payees : null };
}

module.exports = {
  TYPES_QUART, LIBELLES_TYPE, ARRONDIS_OFFERTS, REGLAGES_DEFAUT, SEUIL_QUART_LONG_HEURES,
  arrondirInstant, calculerJours, totaliser,
};
