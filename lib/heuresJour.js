// Heures réellement travaillées par un employé une journée (modèle
// HeuresJourEmploye), entrées par le gérant dans Productivité par employés.
// Quand elles existent, elles remplacent les heures prévues de l'horaire pour
// ce jour-là dans les rapports de productivité et de rentabilité. La paie ne
// les utilise pas (elle a ses propres heures manuelles). Serveur seulement.
const { prisma } = require("./prisma");
const { joursCalendairesQuebec, dateQuebecStr } = require("./temps");

// Map "employeId|AAAA-MM-JJ" → heures, pour les jours de debutStr à finStr
async function chargerHeuresJour(debutStr, finStr, employeId) {
  const lignes = await prisma.heuresJourEmploye.findMany({
    where: { date: { gte: debutStr, lte: finStr }, ...(employeId ? { employeId } : {}) },
  });
  return new Map(lignes.map((l) => [`${l.employeId}|${l.date}`, l.heures]));
}

// Heures payées d'un employé sur une période, pour les rapports : chaque jour
// poinçonné (ou dont les heures réelles ont été entrées) compte ses heures
// réelles si elles ont été entrées, sinon l'horaire prévu de ce jour-là.
function heuresJoursTravailles(employeId, entrees, debut, fin, horaire, heuresJour) {
  const joursPoinconnes = new Set(entrees.map((e) => dateQuebecStr(e.debut)));
  return joursCalendairesQuebec(debut, fin).reduce((s, j) => {
    const reelles = heuresJour.get(`${employeId}|${j.dateStr}`);
    if (reelles !== undefined) return s + reelles;
    return s + (joursPoinconnes.has(j.dateStr) ? horaire[j.jour] || 0 : 0);
  }, 0);
}

// Coût d'une durée de tâche interne au coût horaire du garage
function coutHeures(heures, coutHoraire) {
  return Math.round(heures * coutHoraire * 100) / 100;
}

module.exports = { chargerHeuresJour, heuresJoursTravailles, coutHeures };
