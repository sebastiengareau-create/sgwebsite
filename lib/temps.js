// Le serveur (Railway) tourne en UTC, pas en heure du Québec — sans ces
// fonctions, "aujourd'hui" et les limites d'une journée changeraient environ
// 4-5h trop tôt (dès 20h au Québec, le serveur pense déjà être le lendemain).

const FUSEAU = "America/Toronto"; // même fuseau que Montréal/Québec

// Retourne la date du jour au Québec, format "YYYY-MM-DD"
function dateAujourdhuiQuebec() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// Calcule le décalage actuel du Québec par rapport à UTC (-4 en été, -5 en hiver)
function decalageHeuresQuebec(dateReference) {
  const partie = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU, timeZoneName: "shortOffset",
  }).formatToParts(dateReference).find((p) => p.type === "timeZoneName")?.value || "GMT-5";
  return parseInt(partie.replace("GMT", ""), 10) || -5;
}

// Pour une date "YYYY-MM-DD" (comprise comme une journée civile au Québec),
// retourne les vrais instants UTC de son début et sa fin — pour interroger
// correctement la base de données peu importe la saison (heure d'été/hiver)
function limitesJourQuebec(dateStr) {
  const [an, mois, jour] = dateStr.split("-").map(Number);
  const decalage = decalageHeuresQuebec(new Date(Date.UTC(an, mois - 1, jour, 12)));
  const debut = new Date(Date.UTC(an, mois - 1, jour, -decalage, 0, 0, 0));
  const fin = new Date(Date.UTC(an, mois - 1, jour, -decalage + 24, 0, 0, -1));
  return { debut, fin };
}

// Convertit une date + heure exprimées en heure du Québec (ex. envoyées par
// un système externe comme le site de réservation en ligne) vers le bon
// instant UTC à stocker en base de données.
function dateHeureQuebecVersUTC(dateStr, heureStr) {
  const [an, mois, jour] = dateStr.split("-").map(Number);
  const [h, m] = heureStr.split(":").map(Number);
  const decalage = decalageHeuresQuebec(new Date(Date.UTC(an, mois - 1, jour, 12)));
  return new Date(Date.UTC(an, mois - 1, jour, h - decalage, m, 0));
}

// Même chose, mais à partir d'un champ <input type="datetime-local">
// (format "YYYY-MM-DDTHH:MM") — utilisé partout où le gérant/secrétaire
// entre une heure manuellement (ex. attribuer du temps à un employé)
function dateHeureLocaleVersUTC(datetimeLocalStr) {
  const [datePart, heurePart] = datetimeLocalStr.split("T");
  return dateHeureQuebecVersUTC(datePart, heurePart);
}

// Pour une année + un mois (1-12), retourne les vrais instants UTC de son
// début et sa fin, en heure du Québec — même logique que limitesJourQuebec
// mais pour un mois complet (utilisé par la fermeture de période).
function limitesMoisQuebec(annee, mois) {
  const dernierJour = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  const { debut } = limitesJourQuebec(`${annee}-${String(mois).padStart(2, "0")}-01`);
  const { fin } = limitesJourQuebec(`${annee}-${String(mois).padStart(2, "0")}-${String(dernierJour).padStart(2, "0")}`);
  return { debut, fin };
}

module.exports = { dateAujourdhuiQuebec, limitesJourQuebec, limitesMoisQuebec, dateHeureQuebecVersUTC, dateHeureLocaleVersUTC, FUSEAU };
