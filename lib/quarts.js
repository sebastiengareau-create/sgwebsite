// Pointage de quart et feuilles de temps (module « module_quarts »,
// Administrateur → Modules, inactif par défaut). Serveur seulement.
//
// L'horodateur mesure le temps PAR TÂCHE (EntreeTemps, EntreeTempsInterne) :
// il sert à facturer et à mesurer la productivité. Le quart (modèle Quart)
// mesure le temps de PRÉSENCE : il sert à la paie. Les garder séparés donne
// l'efficacité — présence comparée au temps passé sur les bons.
//
// - L'employé pointe son arrivée, son dîner, ses pauses et son départ
//   (/mecanicien). Une tâche ne se poinçonne qu'à l'intérieur d'un quart
//   ouvert : démarrer une tâche sans avoir pointé ouvre le quart (ouvertAuto)
//   et termine le dîner ou la pause en cours ; pointer un dîner, une pause ou
//   le départ arrête les chronos de tâche en cours.
// - Départ oublié : le lendemain, le quart est fermé à la fin du dernier
//   poinçon de tâche de la journée (fermeAuto) et signalé au gérant.
// - Feuille de temps (/gerant/feuilles-temps) : heures par jour, total,
//   heures supplémentaires à la semaine (lib/heuresPaie.js), anomalies,
//   corrections consignées (CorrectionQuart), verrouillage de la période
//   (PeriodeTemps) et export vers la paie.
// - Avec le module actif, la paie (lib/paie.js) et les rapports de
//   productivité (lib/heuresJour.js) prennent les heures de présence.
const { prisma } = require("./prisma");
const { lireParametres } = require("./parametres");
const { dateQuebecStr, dateAujourdhuiQuebec, limitesJourQuebec, dateHeureQuebecVersUTC, jourSemaineQuebec, FUSEAU } = require("./temps");
const { calculerJours, totaliser, REGLAGES_DEFAUT, ARRONDIS_OFFERTS, LIBELLES_TYPE } = require("./quartsCalculs");
const { calculerHeuresPeriode, SEMAINE_NORMALE } = require("./heuresPaie");
const { joursFeriesEntre } = require("./joursFeries");

const CLE_MODULE_QUARTS = "module_quarts";
const CLES_REGLAGES = { arrondiMinutes: "quart_arrondi_minutes", calerOuverture: "quart_caler_ouverture", dinerPaye: "quart_diner_paye" };
// Semaines relues avant la période : semaine à cheval, référence des jours fériés
const JOURS_AVANT_PERIODE = 42;

async function quartsActif() {
  return (await lireParametres([CLE_MODULE_QUARTS]))[CLE_MODULE_QUARTS] === "actif";
}

async function lireReglagesQuarts() {
  const dict = await lireParametres(Object.values(CLES_REGLAGES));
  const arrondi = Number(dict[CLES_REGLAGES.arrondiMinutes]);
  const ouiNon = (cle, defaut) => (dict[cle] === undefined ? defaut : dict[cle] === "oui");
  return {
    arrondiMinutes: dict[CLES_REGLAGES.arrondiMinutes] !== undefined && ARRONDIS_OFFERTS.includes(arrondi) ? arrondi : REGLAGES_DEFAUT.arrondiMinutes,
    calerOuverture: ouiNon(CLES_REGLAGES.calerOuverture, REGLAGES_DEFAUT.calerOuverture),
    dinerPaye: ouiNon(CLES_REGLAGES.dinerPaye, REGLAGES_DEFAUT.dinerPaye),
  };
}

const heureLocale = (date) => new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(date)).replace(" h ", ":");
// « Travail · 2026-11-12 07:58 – 16:42 » : la valeur d'un quart, en clair, pour le journal
function decrireQuart(q) {
  return `${LIBELLES_TYPE[q.type] || q.type} · ${dateQuebecStr(q.debut)} ${heureLocale(q.debut)} – ${q.fin ? heureLocale(q.fin) : "en cours"}`;
}

async function journaliser(session, { quartId = null, employe = null, jour, action, ancienne = null, nouvelle = null, raison = null }, client = prisma) {
  await client.correctionQuart.create({
    data: {
      quartId, employeId: employe?.id || null, employeNom: employe?.nom || null, jour, action, ancienne, nouvelle,
      raison: raison || null, parId: session?.id || null, parNom: session?.nom || "Système",
    },
  });
}

// Période verrouillée qui contient ce jour, ou null
async function periodeVerrouillee(dateStr) {
  return prisma.periodeTemps.findFirst({ where: { statut: "VERROUILLEE", debut: { lte: dateStr }, fin: { gte: dateStr } } });
}

// ---------------------------------------------------------------------------
// Pointage

// Départ oublié : un quart de travail resté ouvert depuis un autre jour est
// fermé à la fin du dernier poinçon de tâche de sa journée. Sans poinçon de
// tâche terminé ce jour-là, il reste ouvert — anomalie que le gérant corrige.
// Les dîners et pauses restés ouverts suivent. Appelé avant chaque pointage
// et à l'ouverture de la feuille de temps : pas besoin de tâche planifiée.
async function fermerQuartsOublies(employeId) {
  const debutAujourdhui = limitesJourQuebec(dateAujourdhuiQuebec()).debut;
  const ouverts = await prisma.quart.findMany({
    where: { fin: null, debut: { lt: debutAujourdhui }, ...(employeId ? { employeId } : {}) },
    orderBy: { debut: "asc" },
  });
  for (const q of ouverts.filter((o) => o.type === "TRAVAIL")) {
    const { fin: finJour } = limitesJourQuebec(dateQuebecStr(q.debut));
    const critere = { employeId: q.employeId, debut: { gte: q.debut, lte: finJour }, fin: { not: null } };
    const [bon, interne] = await Promise.all([
      prisma.entreeTemps.findFirst({ where: critere, orderBy: { fin: "desc" } }),
      prisma.entreeTempsInterne.findFirst({ where: critere, orderBy: { fin: "desc" } }),
    ]);
    const fin = [bon?.fin, interne?.fin].filter(Boolean).sort((a, b) => b - a)[0];
    if (!fin || fin <= q.debut) continue;
    await prisma.quart.updateMany({ where: { id: q.id, fin: null }, data: { fin, fermeAuto: true } });
    q.fin = fin;
  }
  for (const c of ouverts.filter((o) => o.type !== "TRAVAIL")) {
    // Fermé à la fin de son quart (au plus tôt à son propre début : durée nulle)
    const quart = await prisma.quart.findFirst({
      where: { employeId: c.employeId, type: "TRAVAIL", debut: { lte: c.debut }, fin: { not: null } },
      orderBy: { debut: "desc" },
    });
    if (!quart || dateQuebecStr(quart.debut) !== dateQuebecStr(c.debut)) continue;
    const fin = quart.fin > c.debut ? quart.fin : c.debut;
    await prisma.quart.updateMany({ where: { id: c.id, fin: null }, data: { fin, fermeAuto: true } });
  }
}

// Quart de travail et dîner/pause en cours d'un employé
async function etatQuart(employeId) {
  const ouverts = await prisma.quart.findMany({ where: { employeId, fin: null }, orderBy: { debut: "desc" } });
  return {
    travail: ouverts.find((q) => q.type === "TRAVAIL") || null,
    coupure: ouverts.find((q) => q.type !== "TRAVAIL") || null,
  };
}

// Arrête les chronos de tâche (bons et tâches internes) en cours d'un employé
async function arreterChronos(employeId, instant) {
  const [bons, internes] = await Promise.all([
    prisma.entreeTemps.updateMany({ where: { employeId, fin: null }, data: { fin: instant } }),
    prisma.entreeTempsInterne.updateMany({ where: { employeId, fin: null }, data: { fin: instant } }),
  ]);
  return bons.count + internes.count;
}

// Avant de démarrer un chrono de tâche : la tâche doit être dans un quart
// ouvert. Termine le dîner ou la pause en cours, et ouvre le quart si
// l'arrivée n'a pas été pointée. Sans effet si le module est inactif.
async function assurerQuartPourTache(employeId, instant = new Date()) {
  if (!(await quartsActif())) return;
  await fermerQuartsOublies(employeId);
  const { travail, coupure } = await etatQuart(employeId);
  if (coupure) await prisma.quart.update({ where: { id: coupure.id }, data: { fin: instant } });
  // Un quart resté ouvert d'un autre jour (départ oublié, rien pour le
  // fermer) ne couvre pas la tâche d'aujourd'hui : un nouveau quart s'ouvre
  if (!travail || dateQuebecStr(travail.debut) !== dateQuebecStr(instant)) {
    await prisma.quart.create({ data: { employeId, type: "TRAVAIL", debut: instant, ouvertAuto: true } });
  }
}

const ACTIONS_POINTAGE = ["arrivee", "depart", "diner", "pause", "retour"];

// Pointage par l'employé. Retourne { erreur } ou { ok, chronosArretes }.
async function pointer(employeId, action) {
  if (!ACTIONS_POINTAGE.includes(action)) return { erreur: "Pointage inconnu." };
  await fermerQuartsOublies(employeId);
  const maintenant = new Date();
  let { travail, coupure } = await etatQuart(employeId);
  // Quart resté ouvert d'un autre jour : il ne compte pas comme le quart d'aujourd'hui
  if (travail && dateQuebecStr(travail.debut) !== dateQuebecStr(maintenant)) travail = null;

  if (action === "arrivee") {
    if (travail) return { erreur: "Ton arrivée est déjà pointée." };
    await prisma.quart.create({ data: { employeId, type: "TRAVAIL", debut: maintenant } });
    return { ok: true, chronosArretes: 0 };
  }
  if (!travail) return { erreur: "Pointe d'abord ton arrivée." };

  if (action === "retour") {
    if (!coupure) return { erreur: "Aucun dîner ni pause en cours." };
    await prisma.quart.update({ where: { id: coupure.id }, data: { fin: maintenant } });
    return { ok: true, chronosArretes: 0 };
  }
  if (action === "diner" || action === "pause") {
    if (coupure) return { erreur: `Termine d'abord ${coupure.type === "DINER" ? "ton dîner" : "ta pause"}.` };
    const chronosArretes = await arreterChronos(employeId, maintenant);
    await prisma.quart.create({ data: { employeId, type: action === "diner" ? "DINER" : "PAUSE", debut: maintenant } });
    return { ok: true, chronosArretes };
  }
  // Départ : ferme le dîner ou la pause en cours, les chronos, puis le quart
  const chronosArretes = await arreterChronos(employeId, maintenant);
  if (coupure) await prisma.quart.update({ where: { id: coupure.id }, data: { fin: maintenant } });
  await prisma.quart.update({ where: { id: travail.id }, data: { fin: maintenant } });
  return { ok: true, chronosArretes };
}

// ---------------------------------------------------------------------------
// Feuilles de temps

const decalerStr = (dateStr, jours) => new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + jours * 86400000).toISOString().slice(0, 10);
const debutSemaine = (dateStr) => decalerStr(dateStr, -new Date(`${dateStr}T12:00:00Z`).getUTCDay());

// Instant d'ouverture du commerce un jour donné (Paramètres ouverture_XXX), ou null
async function chargerOuvertures() {
  const { chargerReglagesDisponibilites } = require("./disponibilites");
  const { heures } = await chargerReglagesDisponibilites();
  return (dateStr) => {
    const horaire = heures[jourSemaineQuebec(new Date(`${dateStr}T12:00:00Z`))];
    return horaire ? dateHeureQuebecVersUTC(dateStr, horaire.ouverture) : null;
  };
}

// Jours calculés (lib/quartsCalculs.js) de chaque employé qui a des quarts
// ou des poinçons de tâche entre deux instants : Map employeId → Map jour → …
async function chargerJoursParEmploye(depuis, jusqua, employeId) {
  const filtre = { debut: { gte: depuis, lte: jusqua }, ...(employeId ? { employeId } : {}) };
  const [quarts, bons, internes, reglages, ouvertureDuJour] = await Promise.all([
    prisma.quart.findMany({ where: filtre, orderBy: { debut: "asc" } }),
    prisma.entreeTemps.findMany({ where: filtre, select: { employeId: true, debut: true, fin: true } }),
    prisma.entreeTempsInterne.findMany({ where: filtre, select: { employeId: true, debut: true, fin: true } }),
    lireReglagesQuarts(),
    chargerOuvertures(),
  ]);
  const grouper = (lignes) => {
    const carte = new Map();
    for (const l of lignes) carte.set(l.employeId, [...(carte.get(l.employeId) || []), l]);
    return carte;
  };
  const [q, b, i] = [grouper(quarts), grouper(bons), grouper(internes)];
  const resultat = new Map();
  for (const id of new Set([...q.keys(), ...b.keys(), ...i.keys()])) {
    resultat.set(id, calculerJours({ quarts: q.get(id) || [], entreesBons: b.get(id) || [], entreesInternes: i.get(id) || [], reglages, ouvertureDuJour }));
  }
  return { parEmploye: resultat, reglages };
}

// Heures de présence payées par jour d'un employé (pour la paie) : Map
// "AAAA-MM-JJ" → heures. Les quarts encore ouverts ne comptent pas.
async function heuresPresenceEmploye(employeId, depuis, jusqua) {
  await fermerQuartsOublies(employeId);
  const { parEmploye } = await chargerJoursParEmploye(depuis, jusqua, employeId);
  const jours = parEmploye.get(employeId) || new Map();
  return new Map([...jours.values()].filter((j) => !j.enCours).map((j) => [j.dateStr, j.payees]));
}

// Heures de présence payées par jour, tous employés, pour les rapports de
// productivité : Map "employeId|AAAA-MM-JJ" → heures (jours avec un quart seulement)
async function heuresPresenceParJour(debutStr, finStr, employeId) {
  const { parEmploye } = await chargerJoursParEmploye(limitesJourQuebec(debutStr).debut, limitesJourQuebec(finStr).fin, employeId);
  const carte = new Map();
  for (const [id, jours] of parEmploye) {
    for (const j of jours.values()) if (j.quarts.length > 0 && j.payees > 0) carte.set(`${id}|${j.dateStr}`, j.payees);
  }
  return carte;
}

/**
 * Feuilles de temps d'une période (dates du Québec, bornes incluses) : une
 * par employé qui a pointé un quart ou poinçonné une tâche dans la période.
 * Retourne { periode, reglages, feuilles: [{ employe, jours, total,
 *   heuresRegulieres, heuresSupplementaires, heuresFeries, feries, semaines,
 *   nbAnomalies, nbBloquantes, prime, taux }] }
 */
async function chargerFeuillesTemps(debutStr, finStr) {
  await fermerQuartsOublies();
  const debut = limitesJourQuebec(debutStr).debut;
  const fin = limitesJourQuebec(finStr).fin;
  const depuis = new Date(debut.getTime() - JOURS_AVANT_PERIODE * 86400000);
  const { CLE_CONGE_PAQUES, chargerHoraireOuverture } = require("./paie");
  const [{ parEmploye, reglages }, periode, parametres, horaire] = await Promise.all([
    chargerJoursParEmploye(depuis, fin),
    prisma.periodeTemps.findUnique({ where: { debut_fin: { debut: debutStr, fin: finStr } } }),
    prisma.parametre.findMany({ where: { cle: { in: ["cout_horaire_mecanicien", CLE_CONGE_PAQUES] } } }),
    chargerHoraireOuverture(),
  ]);
  const parametre = (cle) => parametres.find((p) => p.cle === cle)?.valeur;
  const feries = joursFeriesEntre(dateQuebecStr(depuis), finStr, { paques: parametre(CLE_CONGE_PAQUES) === "LUNDI" ? "LUNDI" : "VENDREDI" });
  const datesPeriode = [];
  for (let d = debutStr; d <= finStr; d = decalerStr(d, 1)) datesPeriode.push(d);

  const concernes = [...parEmploye.entries()].filter(([, jours]) => datesPeriode.some((d) => jours.has(d)));
  const employes = await prisma.user.findMany({
    where: { id: { in: concernes.map(([id]) => id) } },
    select: { id: true, nom: true, numeroEmploye: true, role: true, actif: true, tauxHoraireEmploye: true, typeRemuneration: true },
  });
  const primes = periode?.primes || {};

  const feuilles = [];
  for (const [id, joursEmploye] of concernes) {
    const employe = employes.find((e) => e.id === id);
    if (!employe) continue;
    const vide = (dateStr) => ({ dateStr, quarts: [], segments: [], presence: 0, diner: 0, pauses: 0, payees: 0, bons: 0, internes: 0, nonAttribue: 0, efficacite: null, enCours: false, anomalies: [] });
    const jours = datesPeriode.map((d) => joursEmploye.get(d) || vide(d));
    // Heures régulières et supplémentaires : la même règle que la paie
    // (au-delà de 40 heures dans la semaine du dimanche au samedi, réglée
    // dans la période où la semaine se termine)
    const heuresPresence = new Map([...joursEmploye.values()].filter((j) => !j.enCours).map((j) => [j.dateStr, j.payees]));
    const heures = calculerHeuresPeriode({ entrees: [], debutStr, finStr, horaire, horaireComplet: false, feries, heuresPresence });
    const semaines = [];
    for (let dimanche = debutSemaine(debutStr); dimanche <= finStr; dimanche = decalerStr(dimanche, 7)) {
      let total = 0;
      for (let i = 0; i < 7; i++) total += heuresPresence.get(decalerStr(dimanche, i)) || 0;
      const samedi = decalerStr(dimanche, 6);
      semaines.push({
        dimanche, samedi, heures: Math.round(total * 100) / 100,
        supplementaires: Math.round(Math.max(0, total - SEMAINE_NORMALE) * 100) / 100,
        // Semaine à cheval sur la période suivante : ses heures supplémentaires s'y régleront
        complete: samedi <= finStr,
      });
    }
    const anomalies = jours.flatMap((j) => j.anomalies);
    feuilles.push({
      employe, jours, total: totaliser(jours),
      heuresRegulieres: heures.heuresRegulieres, heuresSupplementaires: heures.heuresSupplementaires,
      heuresFeries: heures.heuresFeries, feries: heures.feries, semaines,
      nbAnomalies: anomalies.length, nbBloquantes: anomalies.filter((a) => a.bloquante).length,
      prime: Number(primes[id]) || 0,
      taux: employe.tauxHoraireEmploye || Number(parametre("cout_horaire_mecanicien")) || 0,
    });
  }
  feuilles.sort((a, b) => a.employe.nom.localeCompare(b.employe.nom, "fr"));
  return { periode, reglages, feuilles };
}

// Période proposée à l'ouverture de la feuille de temps : celle qui suit la
// dernière période enregistrée (même durée) si elle a commencé, sinon les
// deux semaines (dimanche au samedi) qui se terminent ce samedi.
async function periodeParDefaut() {
  const aujourdhui = dateAujourdhuiQuebec();
  const derniere = await prisma.periodeTemps.findFirst({ orderBy: { fin: "desc" } });
  if (derniere) {
    const jours = Math.round((new Date(`${derniere.fin}T12:00:00Z`) - new Date(`${derniere.debut}T12:00:00Z`)) / 86400000) + 1;
    let debut = derniere.debut;
    while (decalerStr(debut, jours - 1) < aujourdhui) debut = decalerStr(debut, jours);
    // Dernière période encore ouverte et terminée : on y revient d'abord
    if (derniere.statut !== "VERROUILLEE" && derniere.fin < aujourdhui) return { debut: derniere.debut, fin: derniere.fin };
    return { debut, fin: decalerStr(debut, jours - 1) };
  }
  const samedi = decalerStr(debutSemaine(aujourdhui), 6);
  return { debut: decalerStr(samedi, -13), fin: samedi };
}

module.exports = {
  CLE_MODULE_QUARTS, CLES_REGLAGES, ACTIONS_POINTAGE,
  quartsActif, lireReglagesQuarts, etatQuart, pointer, assurerQuartPourTache, fermerQuartsOublies,
  periodeVerrouillee, journaliser, decrireQuart, heureLocale,
  heuresPresenceEmploye, heuresPresenceParJour, chargerFeuillesTemps, periodeParDefaut, decalerStr,
};

// Accès du gérant aux feuilles de temps : module actif et section « Employés »
async function accesFeuillesTemps(session) {
  const { aAccesSection } = require("./auth");
  return !!session && (await quartsActif()) && (await aAccesSection(session, "employes"));
}
module.exports.accesFeuillesTemps = accesFeuillesTemps;
