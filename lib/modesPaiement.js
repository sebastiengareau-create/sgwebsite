// Liste partagée entre les formulaires (composants client) et
// lib/comptabilite.js (description des écritures) — aucune dépendance à
// Prisma ici, donc importable telle quelle depuis un composant "use client".
const MODES_PAIEMENT = [
  { valeur: "COMPTANT", label: "💵 Comptant" },
  { valeur: "CARTE_DEBIT", label: "💳 Carte de débit" },
  { valeur: "CARTE_CREDIT", label: "💳 Carte de crédit" },
  { valeur: "VIREMENT", label: "🏦 Virement" },
  { valeur: "INTERAC", label: "📱 Interac" },
  { valeur: "CHEQUE", label: "🖊️ Chèque" },
  { valeur: "AUTRE", label: "Autre" },
];

const LABEL_MODE_PAIEMENT = {
  ...Object.fromEntries(MODES_PAIEMENT.map((m) => [m.valeur, m.label])),
  // Facture d'un bon sur un véhicule à vendre, payée en augmentant le
  // coûtant du véhicule (lib/vehiculesAVendre.js) — jamais choisi à la main
  COUTANT_VEHICULE: "🚐 Ajoutée au coûtant du véhicule",
};

module.exports = { MODES_PAIEMENT, LABEL_MODE_PAIEMENT };
