// Échéance des comptes à payer — calculs en journées civiles du Québec,
// sans dépendance à Prisma : importable depuis un composant "use client".
const { dateQuebecStr, dateAujourdhuiQuebec } = require("./temps");

// Conditions de paiement proposées à la saisie d'une facture fournisseur
// (nombre de jours après la date de facture ; null = date précise choisie).
const CONDITIONS_PAIEMENT = [
  { valeur: "0", label: "À réception", jours: 0 },
  { valeur: "15", label: "Net 15 jours", jours: 15 },
  { valeur: "30", label: "Net 30 jours", jours: 30 },
  { valeur: "45", label: "Net 45 jours", jours: 45 },
  { valeur: "60", label: "Net 60 jours", jours: 60 },
  { valeur: "DATE", label: "Date précise…", jours: null },
  { valeur: "AUCUNE", label: "Aucune échéance", jours: null },
];

// "YYYY-MM-DD" + n jours → "YYYY-MM-DD" (ancré à midi UTC, jamais de recul d'un jour)
function ajouterJours(dateStr, jours) {
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

// Jours restants avant l'échéance (négatif = en retard), null si aucune échéance
function joursAvantEcheance(dateEcheance) {
  if (!dateEcheance) return null;
  const echeance = new Date(`${dateQuebecStr(new Date(dateEcheance))}T12:00:00Z`);
  const aujourdhui = new Date(`${dateAujourdhuiQuebec()}T12:00:00Z`);
  return Math.round((echeance - aujourdhui) / 86400000);
}

// Pastille d'état d'une dépense impayée : { texte, couleur } ou null
function etatEcheance(depense) {
  if (depense.statut !== "IMPAYEE") return null;
  const jours = joursAvantEcheance(depense.dateEcheance);
  if (jours === null) return null;
  if (jours < 0) return { texte: `En retard de ${-jours} j`, couleur: "var(--danger)", enRetard: true };
  if (jours === 0) return { texte: "Due aujourd'hui", couleur: "#C9A227", enRetard: false };
  if (jours <= 7) return { texte: `Due dans ${jours} j`, couleur: "#C9A227", enRetard: false };
  return { texte: `Due le ${new Date(depense.dateEcheance).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}`, couleur: "var(--text-muted)", enRetard: false };
}

module.exports = { CONDITIONS_PAIEMENT, ajouterJours, joursAvantEcheance, etatEcheance };
