// Rappel de poinçon oublié : chaque jour d'ouverture, une heure après la
// fermeture (Paramètres ouverture_XXX / fermeture_XXX, mêmes heures que le
// calendrier — voir lib/disponibilites.js), chaque employé encore poinçonné
// (sur un bon ou une tâche interne) reçoit une notification lui demandant
// d'arrêter son poinçon. Rien les jours fermés.
//
// Le planificateur (lib/planificateurSauvegarde.js) appelle
// verifierRappelPoincons() chaque minute, mais la base n'est lue qu'à
// l'heure du prochain rappel, gardée en mémoire — et au moins aux 6 heures,
// ou dès que les paramètres changent (oublierProchainRappelPoincons), pour
// suivre un changement des heures d'ouverture. Même principe que
// lib/notificationsCedulees.js : le serveur peut dormir sur Railway.
const { prisma } = require("./prisma");
const { notifier, notificationsActives } = require("./notifications");
const { chargerReglagesDisponibilites } = require("./disponibilites");
const { dateAujourdhuiQuebec, dateHeureQuebecVersUTC, FUSEAU } = require("./temps");

// Délai après la fermeture avant le rappel
const DELAI_APRES_FERMETURE_MINUTES = 60;
// Serveur arrêté à l'heure prévue (redémarrage, mise à jour) : le rappel part
// quand même s'il n'a pas plus de ce retard, sinon il est sauté ce jour-là
const RETARD_MAX_MINUTES = 120;
const RELECTURE_MAX_MS = 6 * 3600 * 1000;
// Date (Québec) du dernier rappel envoyé — un seul par jour, même avec
// plusieurs serveurs
const CLE_DERNIER_RAPPEL = "rappel_poincons_dernier_envoi";

const CLES_JOUR_UTC = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

// Instant du rappel d'une date "YYYY-MM-DD", ou null si le commerce est fermé
function instantRappel(date, reglages) {
  const [an, mois, jour] = date.split("-").map(Number);
  const horaire = reglages.heures[CLES_JOUR_UTC[new Date(Date.UTC(an, mois - 1, jour)).getUTCDay()]];
  if (!horaire) return null;
  return dateHeureQuebecVersUTC(date, horaire.fermeture).getTime() + DELAI_APRES_FERMETURE_MINUTES * 60 * 1000;
}

const heureLocale = (date) => new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" }).format(date);

async function envoyerRappels(date) {
  // Réservé avant l'envoi : si deux serveurs vérifient en même temps, un
  // seul l'envoie
  await prisma.parametre.upsert({ where: { cle: CLE_DERNIER_RAPPEL }, update: {}, create: { cle: CLE_DERNIER_RAPPEL, valeur: "" } });
  const reserve = await prisma.parametre.updateMany({ where: { cle: CLE_DERNIER_RAPPEL, valeur: { not: date } }, data: { valeur: date } });
  if (reserve.count === 0) return;

  const [surBons, internes] = await Promise.all([
    prisma.entreeTemps.findMany({
      where: { fin: null },
      select: { employeId: true, debut: true, probleme: { select: { description: true, bon: { select: { numero: true } } } } },
    }),
    prisma.entreeTempsInterne.findMany({
      where: { fin: null },
      select: { employeId: true, debut: true, tacheInterne: { select: { nom: true } } },
    }),
  ]);

  const parEmploye = new Map();
  const ajouter = (employeId, ligne) => parEmploye.set(employeId, [...(parEmploye.get(employeId) || []), ligne]);
  for (const e of surBons) ajouter(e.employeId, `#${e.probleme.bon.numero} — ${e.probleme.description} (depuis ${heureLocale(e.debut)})`);
  for (const e of internes) ajouter(e.employeId, `${e.tacheInterne.nom} (depuis ${heureLocale(e.debut)})`);

  for (const [employeId, lignes] of parEmploye) {
    await notifier("POINCON_OUBLIE", {
      employeIds: [employeId],
      titre: "⏱️ Tu es encore poinçonné",
      corps: `${lignes.join(" · ")}. Si tu as fini, arrête ton poinçon.`,
      url: "/mecanicien",
      tag: "poincon-oublie",
    });
  }
}

const PROCHAIN = Symbol.for("sgwebsite.prochainRappelPoincons");
const oublierProchainRappelPoincons = () => { globalThis[PROCHAIN] = null; };

async function verifierRappelPoincons() {
  const prochain = globalThis[PROCHAIN];
  if (prochain != null && Date.now() < prochain) return;

  const maintenant = Date.now();
  const reglages = await chargerReglagesDisponibilites();
  const aujourdhui = dateAujourdhuiQuebec();

  const instantAujourdhui = instantRappel(aujourdhui, reglages);
  if (instantAujourdhui != null && maintenant >= instantAujourdhui && maintenant - instantAujourdhui <= RETARD_MAX_MINUTES * 60 * 1000 && (await notificationsActives())) {
    await envoyerRappels(aujourdhui);
  }

  // Prochain rappel sur les 8 prochains jours (aujourd'hui compris s'il n'est
  // pas encore passé), relu au plus tard dans 6 heures
  const [an, mois, jour] = aujourdhui.split("-").map(Number);
  let suivant = maintenant + RELECTURE_MAX_MS;
  for (let d = 0; d < 8; d++) {
    const date = new Date(Date.UTC(an, mois - 1, jour + d)).toISOString().slice(0, 10);
    const instant = instantRappel(date, reglages);
    if (instant != null && instant > maintenant) { suivant = Math.min(suivant, instant); break; }
  }
  globalThis[PROCHAIN] = suivant;
}

module.exports = { verifierRappelPoincons, oublierProchainRappelPoincons, DELAI_APRES_FERMETURE_MINUTES };
