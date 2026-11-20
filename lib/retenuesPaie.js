// Retenues propres à un employé, en plus des retenues obligatoires : une
// cotisation à un REER, la part de l'employé d'une assurance collective,
// un remboursement… Réglées dans la fiche d'employé (modèle RetenueEmploye),
// appliquées à chaque paie régulière (lib/paie.js) et gardées, telles
// qu'appliquées, sur la paie (Paie.retenuesDetail).
//
// Deux types :
// - "REER" : cotisation à un régime de retraite (REER, RPA, RVER, RPAC,
//   CELIAPP) retenue sur la paie. Elle réduit le revenu sur lequel l'impôt
//   est calculé (variable F des guides TP-1015.F et T4127), pas les
//   cotisations au RRQ, au RQAP ni à l'assurance-emploi.
// - "APRES_IMPOT" : retenue qui ne change aucun calcul (assurance
//   collective payée par l'employé, remboursement d'une avance, etc.) ; elle
//   réduit seulement le net versé.
const TYPES_RETENUE = {
  REER: "REER ou régime de retraite (réduit l'impôt retenu)",
  APRES_IMPOT: "Assurance collective ou autre (après impôt)",
};

const arrondir = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Retenues à appliquer à une paie : le détail et les deux totaux
function retenuesPourPaie(retenues) {
  const detail = retenues
    .filter((r) => r.actif !== false && r.montant > 0)
    .map((r) => ({ libelle: r.libelle, type: r.type === "REER" ? "REER" : "APRES_IMPOT", montant: arrondir(r.montant) }));
  const total = (type) => arrondir(detail.filter((d) => d.type === type).reduce((s, d) => s + d.montant, 0));
  return { detail, deductibles: total("REER"), apresImpot: total("APRES_IMPOT") };
}

// Détail des retenues gardé sur une paie (tableau, ou rien pour une paie d'avant leur ajout)
function detailRetenues(paie) {
  return Array.isArray(paie?.retenuesDetail) ? paie.retenuesDetail : [];
}

// Cumul de l'année par libellé, pour le talon de paie : { "REER": 1200, … }
function cumulRetenuesAnnee(paies) {
  const cumul = {};
  for (const p of paies) for (const d of detailRetenues(p)) cumul[d.libelle] = arrondir((cumul[d.libelle] || 0) + d.montant);
  return cumul;
}

module.exports = { TYPES_RETENUE, retenuesPourPaie, detailRetenues, cumulRetenuesAnnee };
