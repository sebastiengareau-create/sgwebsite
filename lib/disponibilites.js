// Disponibilités du calendrier — quelles cases horaires peuvent recevoir un
// rendez-vous. Une case est libre si elle tient entièrement dans les heures
// d'ouverture du jour (Paramètres ouverture_XXX / fermeture_XXX), ne touche
// aucune période indisponible de l'atelier et que le nombre de rendez-vous
// qui la chevauchent reste sous la capacité (rendez-vous simultanés max).
// Utilisé par le calendrier, la création de rendez-vous et l'API publique
// du site de réservation (app/api/rendezvous/disponibilites).
const { prisma } = require("./prisma");
const { dateHeureQuebecVersUTC, dateQuebecStr, limitesJourQuebec } = require("./temps");
const { chargerHoraireOuverture } = require("./paie");

const JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const CLES_JOUR_UTC = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"]; // index = getUTCDay()

// Tant que les heures d'ouverture d'un jour n'ont pas été enregistrées, on
// les déduit de l'horaire déjà configuré (heures_XXX, voir lib/paie.js) :
// 0 h = fermé, sinon ouverture à 8 h pour ce nombre d'heures.
const OUVERTURE_DEDUITE = "08:00";
const DEFAUT_INTERVALLE_MINUTES = 30;
const DEFAUT_CAPACITE = 1;
const MAX_JOURS_PAR_REQUETE = 62;

const FORMAT_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutes(heureStr) {
  const [h, m] = heureStr.split(":").map(Number);
  return h * 60 + m;
}

function heureStr(totalMinutes) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function cleJour(dateStr) {
  const [an, mois, jour] = dateStr.split("-").map(Number);
  return CLES_JOUR_UTC[new Date(Date.UTC(an, mois - 1, jour)).getUTCDay()];
}

function joursEntre(debutStr, finStr) {
  const jours = [];
  const [an, mois, jour] = debutStr.split("-").map(Number);
  const curseur = new Date(Date.UTC(an, mois - 1, jour));
  while (jours.length < MAX_JOURS_PAR_REQUETE) {
    const str = curseur.toISOString().slice(0, 10);
    if (str > finStr) break;
    jours.push(str);
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return jours;
}

// Réglages de réservation (Paramètres). Un jour sans paramètre prend la
// valeur par défaut ; une ouverture vide veut dire « fermé ».
async function chargerReglagesDisponibilites() {
  const cles = [
    ...JOURS.flatMap((j) => [`ouverture_${j}`, `fermeture_${j}`]),
    "reservation_intervalle_minutes",
    "reservation_capacite",
  ];
  const [parametres, horairePaie] = await Promise.all([
    prisma.parametre.findMany({ where: { cle: { in: cles } } }),
    chargerHoraireOuverture(),
  ]);
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  const heures = {};
  for (const j of JOURS) {
    if (dict[`ouverture_${j}`] === undefined && dict[`fermeture_${j}`] === undefined) {
      const nbHeures = Number(horairePaie[j]) || 0;
      const fin = Math.min(minutes(OUVERTURE_DEDUITE) + Math.round(nbHeures * 60), 23 * 60 + 59);
      heures[j] = nbHeures > 0 ? { ouverture: OUVERTURE_DEDUITE, fermeture: heureStr(fin) } : null;
      continue;
    }
    const ouverture = dict[`ouverture_${j}`] || "";
    const fermeture = dict[`fermeture_${j}`] || "";
    const valide = FORMAT_HEURE.test(ouverture) && FORMAT_HEURE.test(fermeture) && minutes(ouverture) < minutes(fermeture);
    heures[j] = valide ? { ouverture, fermeture } : null;
  }

  const intervalle = Number(dict.reservation_intervalle_minutes);
  const capacite = Number(dict.reservation_capacite);
  return {
    heures,
    intervalleMinutes: [15, 30, 60].includes(intervalle) ? intervalle : DEFAUT_INTERVALLE_MINUTES,
    capacite: Number.isInteger(capacite) && capacite >= 1 ? capacite : DEFAUT_CAPACITE,
  };
}

// Périodes indisponibles et rendez-vous actifs qui touchent [debut, fin].
async function chargerOccupations(debut, fin, { ignorerRendezVousId } = {}) {
  const [indisponibles, rendezVous] = await Promise.all([
    prisma.periodeIndisponible.findMany({ where: { debut: { lt: fin }, fin: { gt: debut } }, orderBy: { debut: "asc" } }),
    prisma.rendezVous.findMany({
      // Un rendez-vous commencé avant `debut` peut encore déborder dedans
      // (durée max raisonnable : une journée).
      where: { statut: { not: "ANNULE" }, date: { lt: fin, gt: new Date(debut.getTime() - 24 * 3600000) } },
      select: { id: true, date: true, dureeMinutes: true },
    }),
  ]);
  return {
    indisponibles,
    rendezVous: rendezVous
      .filter((r) => r.id !== ignorerRendezVousId)
      .map((r) => ({ debut: r.date, fin: new Date(r.date.getTime() + r.dureeMinutes * 60000) }))
      .filter((r) => r.fin > debut),
  };
}

const chevauche = (a, b) => a.debut < b.fin && b.debut < a.fin;

// Raison pour laquelle [debut, debut + durée] n'est pas réservable, ou null.
function raisonIndisponible(creneau, dateStr, reglages, occupations) {
  const horaire = reglages.heures[cleJour(dateStr)];
  if (!horaire) return "L'atelier est fermé cette journée-là.";
  const ouverture = dateHeureQuebecVersUTC(dateStr, horaire.ouverture);
  const fermeture = dateHeureQuebecVersUTC(dateStr, horaire.fermeture);
  if (creneau.debut < ouverture || creneau.fin > fermeture) {
    return `En dehors des heures d'ouverture (${horaire.ouverture}–${horaire.fermeture}).`;
  }
  const indispo = occupations.indisponibles.find((p) => chevauche(creneau, p));
  if (indispo) return `Période indisponible${indispo.motif ? ` : ${indispo.motif}` : ""}.`;
  const nbRendezVous = occupations.rendezVous.filter((r) => chevauche(creneau, r)).length;
  if (nbRendezVous >= reglages.capacite) return "Ce créneau est déjà complet.";
  return null;
}

// Cases libres, jour par jour, entre deux dates "YYYY-MM-DD" (incluses).
// Les cases déjà passées ne sont jamais offertes.
async function calculerCreneaux({ debutStr, finStr, dureeMinutes }) {
  const reglages = await chargerReglagesDisponibilites();
  const jours = joursEntre(debutStr, finStr);
  if (jours.length === 0) return { reglages, jours: [] };

  const { debut } = limitesJourQuebec(jours[0]);
  const { fin } = limitesJourQuebec(jours[jours.length - 1]);
  const occupations = await chargerOccupations(debut, fin);
  const maintenant = new Date();

  const resultat = jours.map((dateStr) => {
    const horaire = reglages.heures[cleJour(dateStr)];
    if (!horaire) return { date: dateStr, ferme: true, creneaux: [] };
    const creneaux = [];
    for (let m = minutes(horaire.ouverture); m + dureeMinutes <= minutes(horaire.fermeture); m += reglages.intervalleMinutes) {
      const heure = heureStr(m);
      const debutCreneau = dateHeureQuebecVersUTC(dateStr, heure);
      if (debutCreneau < maintenant) continue;
      const creneau = { debut: debutCreneau, fin: new Date(debutCreneau.getTime() + dureeMinutes * 60000) };
      if (!raisonIndisponible(creneau, dateStr, reglages, occupations)) creneaux.push(heure);
    }
    return { date: dateStr, ferme: false, ouverture: horaire.ouverture, fermeture: horaire.fermeture, creneaux };
  });
  return { reglages, jours: resultat };
}

// Vérifie un rendez-vous précis avant de l'enregistrer : null s'il est
// réservable, sinon la raison à afficher.
async function verifierCreneau(debut, dureeMinutes, { ignorerRendezVousId } = {}) {
  const creneau = { debut, fin: new Date(debut.getTime() + dureeMinutes * 60000) };
  const [reglages, occupations] = await Promise.all([
    chargerReglagesDisponibilites(),
    chargerOccupations(creneau.debut, creneau.fin, { ignorerRendezVousId }),
  ]);
  return raisonIndisponible(creneau, dateQuebecStr(debut), reglages, occupations);
}

module.exports = {
  JOURS,
  FORMAT_HEURE,
  chargerReglagesDisponibilites,
  calculerCreneaux,
  verifierCreneau,
};
