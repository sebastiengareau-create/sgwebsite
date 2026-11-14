// Heures d'une période de paie pour un employé payé à l'heure : heures
// régulières, heures supplémentaires et indemnité des jours fériés, selon
// la Loi sur les normes du travail du Québec.
//
// - Heures supplémentaires (art. 52 et 55) : au-delà de 40 heures dans la
//   semaine, à taux et demi. La semaine va du dimanche au samedi ; elle se
//   règle dans la période de paie où elle se termine. Un jour férié chômé
//   compte comme un jour travaillé dans le calcul des 40 heures (art. 56).
// - Jour férié (art. 62) : indemnité de 1/20 du salaire gagné dans les
//   4 semaines complètes qui précèdent la semaine du congé, heures
//   supplémentaires exclues. L'employé qui travaille ce jour-là reçoit son
//   salaire et l'indemnité.
//
// Fonctions pures (aucune lecture en base) : testées par scripts/tester-paie.js.
const { dateQuebecStr } = require("./temps");

const SEMAINE_NORMALE = 40; // heures
const MAJORATION_HEURES_SUP = 1.5;
const SEMAINES_REFERENCE_FERIE = 4;
const FRACTION_FERIE = 1 / 20;
const CLES_JOUR = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

const dateDe = (dateStr) => new Date(`${dateStr}T12:00:00Z`); // midi UTC : jamais près d'un changement d'heure
const versStr = (date) => date.toISOString().slice(0, 10);
const decalerStr = (dateStr, jours) => versStr(new Date(dateDe(dateStr).getTime() + jours * 86400000));
const cleJour = (dateStr) => CLES_JOUR[dateDe(dateStr).getUTCDay()];
// Dimanche qui commence la semaine d'une date
const debutSemaine = (dateStr) => decalerStr(dateStr, -dateDe(dateStr).getUTCDay());
const joursDeSemaine = (dimancheStr) => Array.from({ length: 7 }, (_, i) => decalerStr(dimancheStr, i));
const arrondirHeures = (h) => Math.round(h * 100) / 100;

/**
 * `entrees` : poinçons terminés [{ debut, fin }], au moins depuis 6 semaines
 *   avant le début de la période (semaines à cheval et référence des fériés).
 * `debutStr`, `finStr` : la période, en dates du Québec "AAAA-MM-JJ", bornes incluses.
 * `horaire` : heures d'ouverture par jour { lun: 8, … }.
 * `horaireComplet` : l'employé est payé pour tout l'horaire d'ouverture,
 *   poinçon ou non (secrétaire, gérant…) ; sinon, pour l'horaire des jours poinçonnés.
 * `feries` : jours fériés [{ dateStr, nom }] couvrant la période et les semaines autour.
 */
function calculerHeuresPeriode({ entrees, debutStr, finStr, horaire, horaireComplet, feries = [] }) {
  // Heures réellement poinçonnées, par jour du Québec
  const poinconnees = new Map();
  for (const e of entrees) {
    const jour = dateQuebecStr(e.debut);
    poinconnees.set(jour, (poinconnees.get(jour) || 0) + (new Date(e.fin) - new Date(e.debut)) / 3600000);
  }
  const estFerie = new Set(feries.map((f) => f.dateStr));

  // Heures payées par défaut pour un jour : l'horaire d'ouverture de ce jour
  const heuresJourParDefaut = (dateStr) => (horaireComplet || poinconnees.has(dateStr) ? horaire[cleJour(dateStr)] || 0 : 0);

  // Une semaine (dimanche au samedi) : heures régulières et supplémentaires
  const semaines = new Map();
  const semaine = (dimancheStr) => {
    if (semaines.has(dimancheStr)) return semaines.get(dimancheStr);
    const jours = joursDeSemaine(dimancheStr);
    const travaillees = jours.reduce((s, j) => s + (poinconnees.get(j) || 0), 0);
    // Férié chômé (aucun poinçon) : compte pour l'horaire prévu ce jour-là
    const feriesChomes = jours.reduce((s, j) => s + (estFerie.has(j) && !poinconnees.has(j) ? horaire[cleJour(j)] || 0 : 0), 0);
    const parDefaut = jours.reduce((s, j) => s + heuresJourParDefaut(j), 0);
    const supplementaires = Math.max(0, travaillees + feriesChomes - SEMAINE_NORMALE);
    // Semaine avec heures supplémentaires : 40 heures régulières, moins celles
    // du férié chômé (payé par l'indemnité, sauf pour l'horaire complet)
    const regulieres = supplementaires > 0.005
      ? Math.max(0, SEMAINE_NORMALE - (horaireComplet ? 0 : feriesChomes))
      : parDefaut;
    const resultat = { regulieres, supplementaires: supplementaires > 0.005 ? supplementaires : 0, parDefaut };
    semaines.set(dimancheStr, resultat);
    return resultat;
  };

  // Heures régulières : l'horaire par défaut de chaque jour de la période…
  let heuresRegulieres = 0;
  for (let j = debutStr; j <= finStr; j = decalerStr(j, 1)) heuresRegulieres += heuresJourParDefaut(j);

  // … rajusté pour chaque semaine qui se termine dans la période et compte des
  // heures supplémentaires : ses heures régulières deviennent 40, moins ce
  // que l'horaire par défaut lui donnait déjà (y compris la partie payée à
  // la période précédente, si la semaine est à cheval).
  let heuresSupplementaires = 0;
  for (let dimanche = debutSemaine(debutStr); dimanche <= finStr; dimanche = decalerStr(dimanche, 7)) {
    const samedi = decalerStr(dimanche, 6);
    if (samedi < debutStr || samedi > finStr) continue;
    const s = semaine(dimanche);
    if (s.supplementaires > 0) {
      heuresSupplementaires += s.supplementaires;
      heuresRegulieres += s.regulieres - s.parDefaut;
    }
  }

  // Indemnité de chaque jour férié de la période, en heures : 1/20 des
  // heures régulières des 4 semaines complètes qui précèdent sa semaine.
  // Horaire complet : le jour est déjà payé avec l'horaire, pas d'indemnité.
  const feriesPeriode = feries
    .filter((f) => f.dateStr >= debutStr && f.dateStr <= finStr)
    .map((f) => {
      let reference = 0;
      if (!horaireComplet) {
        const dimanche = debutSemaine(f.dateStr);
        for (let i = 1; i <= SEMAINES_REFERENCE_FERIE; i++) reference += semaine(decalerStr(dimanche, -7 * i)).regulieres;
      }
      return { ...f, heures: arrondirHeures(reference * FRACTION_FERIE), travaille: poinconnees.has(f.dateStr) };
    });

  return {
    heuresRegulieres: arrondirHeures(Math.max(0, heuresRegulieres)),
    heuresSupplementaires: arrondirHeures(heuresSupplementaires),
    heuresFeries: arrondirHeures(feriesPeriode.reduce((s, f) => s + f.heures, 0)),
    feries: feriesPeriode,
  };
}

module.exports = { calculerHeuresPeriode, SEMAINE_NORMALE, MAJORATION_HEURES_SUP, SEMAINES_REFERENCE_FERIE };
