// Listes et calculs de la copropriété (module « Copropriété », voir
// lib/copropriete.js) — sans accès à la base, donc utilisables aussi dans
// les composants du navigateur et le portail des copropriétaires.

export { argent } from "./format";

export const TYPES_UNITE = [
  { code: "LOGEMENT", label: "Logement", icone: "🏠" },
  { code: "COMMERCIAL", label: "Local commercial", icone: "🏪" },
  { code: "STATIONNEMENT", label: "Stationnement (fraction)", icone: "🅿️" },
  { code: "RANGEMENT", label: "Rangement (fraction)", icone: "📦" },
  { code: "AUTRE", label: "Autre", icone: "▫️" },
];

export const TYPES_OCCUPANT = [
  { code: "PROPRIETAIRE", label: "Propriétaire occupant" },
  { code: "LOCATAIRE", label: "Locataire" },
  { code: "OCCUPANT", label: "Autre occupant" },
];

export const TYPES_ESPACE = [
  { code: "STATIONNEMENT", label: "Stationnement", icone: "🅿️" },
  { code: "RANGEMENT", label: "Rangement / casier", icone: "📦" },
  { code: "VELO", label: "Support à vélo", icone: "🚲" },
  { code: "AUTRE", label: "Autre", icone: "▫️" },
];

export const MODES_ESPACE = [
  { code: "USAGE_RESTREINT", label: "Partie commune à usage restreint" },
  { code: "LOCATION", label: "Loué par le syndicat" },
];

export const TYPES_CHARGE = [
  { code: "COTISATION", label: "Charges communes (mensuel)" },
  { code: "SPECIALE", label: "Cotisation spéciale" },
  { code: "ESPACE", label: "Stationnement / rangement" },
  { code: "AUTRE", label: "Autre (frais, pénalité…)" },
];

export const MODES_PAIEMENT = [
  { code: "PREAUTORISE", label: "Prélèvement préautorisé" },
  { code: "VIREMENT", label: "Virement / Interac" },
  { code: "CHEQUE", label: "Chèque" },
  { code: "COMPTANT", label: "Comptant" },
  { code: "AUTRE", label: "Autre" },
];

export const CATEGORIES_TRAVAUX = [
  { code: "PLOMBERIE", label: "Plomberie" },
  { code: "ELECTRICITE", label: "Électricité" },
  { code: "CVAC", label: "Chauffage, ventilation, climatisation" },
  { code: "TOITURE", label: "Toiture" },
  { code: "ENVELOPPE", label: "Enveloppe (murs, fenêtres, balcons)" },
  { code: "STRUCTURE", label: "Structure, fondation" },
  { code: "ASCENSEUR", label: "Ascenseur" },
  { code: "INCENDIE", label: "Sécurité incendie" },
  { code: "STATIONNEMENT", label: "Stationnement, garage" },
  { code: "TERRAIN", label: "Terrain, déneigement, paysagement" },
  { code: "MENAGE", label: "Ménage, conciergerie" },
  { code: "PORTES", label: "Portes, serrures, contrôle d'accès" },
  { code: "AUTRE", label: "Autre" },
];

export const PRIORITES = [
  { code: "URGENTE", label: "Urgente", couleur: "#C2453B", rang: 0 },
  { code: "HAUTE", label: "Haute", couleur: "#D98A2B", rang: 1 },
  { code: "NORMALE", label: "Normale", couleur: "#5B8FD1", rang: 2 },
  { code: "BASSE", label: "Basse", couleur: "#8A8579", rang: 3 },
];

export const STATUTS_DEMANDE = [
  { code: "NOUVELLE", label: "Nouvelle", couleur: "#D98A2B", ouverte: true },
  { code: "ACCEPTEE", label: "Acceptée", couleur: "#5B8FD1", ouverte: true },
  { code: "EN_COURS", label: "Travaux en cours", couleur: "#8C6BC4", ouverte: true },
  { code: "TERMINEE", label: "Terminée", couleur: "#6FA96B", ouverte: false },
  { code: "REFUSEE", label: "Refusée", couleur: "#8A8579", ouverte: false },
];

export const STATUTS_TRAVAIL = [
  { code: "A_PLANIFIER", label: "À planifier", couleur: "#D98A2B", ouvert: true },
  { code: "PLANIFIE", label: "Planifié", couleur: "#5B8FD1", ouvert: true },
  { code: "EN_COURS", label: "En cours", couleur: "#8C6BC4", ouvert: true },
  { code: "TERMINE", label: "Terminé", couleur: "#6FA96B", ouvert: false },
  { code: "ANNULE", label: "Annulé", couleur: "#8A8579", ouvert: false },
];

export const TYPES_DEMANDE = [
  { code: "REPARATION", label: "Demande de réparation" },
  { code: "SIGNALEMENT", label: "Signalement d'un problème" },
];

export const TYPES_ENTRETIEN = [
  { code: "ENTRETIEN", label: "Entretien préventif", icone: "🛠️" },
  { code: "INSPECTION", label: "Inspection", icone: "🔍" },
];

// Ce qui revient le plus souvent dans un immeuble en copropriété au Québec :
// proposé à l'ajout d'un entretien, tout reste modifiable
export const ENTRETIENS_SUGGERES = [
  { titre: "Inspection des extincteurs portatifs", type: "INSPECTION", categorie: "INCENDIE", frequenceMois: 12, obligatoire: true },
  { titre: "Inspection du système d'alarme incendie", type: "INSPECTION", categorie: "INCENDIE", frequenceMois: 12, obligatoire: true },
  { titre: "Inspection des gicleurs", type: "INSPECTION", categorie: "INCENDIE", frequenceMois: 12, obligatoire: true },
  { titre: "Éclairage d'urgence et enseignes de sortie", type: "INSPECTION", categorie: "INCENDIE", frequenceMois: 12, obligatoire: true },
  { titre: "Inspection de l'ascenseur", type: "INSPECTION", categorie: "ASCENSEUR", frequenceMois: 12, obligatoire: true },
  { titre: "Inspection des façades (Loi sur le bâtiment, 5 étages et +)", type: "INSPECTION", categorie: "ENVELOPPE", frequenceMois: 60, obligatoire: true },
  { titre: "Inspection du stationnement étagé", type: "INSPECTION", categorie: "STATIONNEMENT", frequenceMois: 60, obligatoire: true },
  { titre: "Mise à jour de l'étude du fonds de prévoyance", type: "INSPECTION", categorie: "AUTRE", frequenceMois: 60, obligatoire: true },
  { titre: "Mise à jour du carnet d'entretien", type: "INSPECTION", categorie: "AUTRE", frequenceMois: 60, obligatoire: true },
  { titre: "Inspection de la toiture", type: "INSPECTION", categorie: "TOITURE", frequenceMois: 12 },
  { titre: "Entretien du système de chauffage / thermopompes", type: "ENTRETIEN", categorie: "CVAC", frequenceMois: 12 },
  { titre: "Changement des filtres de ventilation", type: "ENTRETIEN", categorie: "CVAC", frequenceMois: 3 },
  { titre: "Nettoyage des conduits de sécheuse", type: "ENTRETIEN", categorie: "CVAC", frequenceMois: 12 },
  { titre: "Ramonage des cheminées", type: "ENTRETIEN", categorie: "CVAC", frequenceMois: 12 },
  { titre: "Vérification des drains et clapets antiretour", type: "ENTRETIEN", categorie: "PLOMBERIE", frequenceMois: 12 },
  { titre: "Entretien du chauffe-eau commun", type: "ENTRETIEN", categorie: "PLOMBERIE", frequenceMois: 12 },
  { titre: "Nettoyage des gouttières et drains de toit", type: "ENTRETIEN", categorie: "TOITURE", frequenceMois: 6 },
  { titre: "Lavage des vitres et façades", type: "ENTRETIEN", categorie: "ENVELOPPE", frequenceMois: 12 },
  { titre: "Nettoyage du garage souterrain", type: "ENTRETIEN", categorie: "STATIONNEMENT", frequenceMois: 12 },
  { titre: "Vérification des portes de garage", type: "ENTRETIEN", categorie: "PORTES", frequenceMois: 6 },
];

export const CATEGORIES_DOCUMENTS = [
  { code: "PV_ASSEMBLEE", label: "Procès-verbaux des assemblées", icone: "🗳️" },
  { code: "REGLEMENTS", label: "Règlements de l'immeuble", icone: "📜" },
  { code: "DECLARATION", label: "Déclaration de copropriété", icone: "⚖️" },
  { code: "ETATS_FINANCIERS", label: "États financiers", icone: "📊" },
  { code: "BUDGETS", label: "Budgets annuels", icone: "💰" },
  { code: "CONTRATS", label: "Contrats de fournisseurs", icone: "🤝" },
  { code: "ASSURANCES", label: "Polices d'assurance", icone: "🛡️" },
  { code: "CARNET_ENTRETIEN", label: "Carnet d'entretien", icone: "🛠️" },
  { code: "FONDS_PREVOYANCE", label: "Étude du fonds de prévoyance", icone: "🏦" },
  { code: "SYNDICAT", label: "Documents du syndicat", icone: "🏛️" },
  { code: "AVIS", label: "Avis et communications", icone: "📣" },
  { code: "PLANS", label: "Plans et devis", icone: "📐" },
  { code: "CERTIFICATS", label: "Certificats, attestations, garanties", icone: "📄" },
  { code: "UNITE", label: "Documents propres à une unité", icone: "🔑" },
  { code: "AUTRE", label: "Autres", icone: "🗂️" },
];

export const VISIBILITES = [
  { code: "COPROPRIETAIRES", label: "Tous les copropriétaires (portail)" },
  { code: "UNITE", label: "Propriétaires de l'unité seulement" },
  { code: "ADMIN", label: "Administration seulement" },
];

export const libelle = (liste, code) => liste.find((x) => x.code === code)?.label || code || "—";
export const trouver = (liste, code) => liste.find((x) => x.code === code);

// « 2026-11-05 » d'une date enregistrée à midi UTC
export const dateCourte = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// Date lisible : « 5 nov. 2026 »
export function dateLisible(d) {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(d));
}

// Pourcentage : « 2,345 % »
export function pourcent(n, decimales = 3) {
  const v = Number(n) || 0;
  return `${v.toFixed(decimales).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",")} %`;
}

const arrondi = (n) => Math.round(n * 100) / 100;

// ---------- Propriétaires ----------

// Propriétés en cours (sans date de fin) d'une unité ou d'un copropriétaire
export const enCours = (proprietes = []) => proprietes.filter((p) => !p.dateFin);

// Nom des propriétaires actuels d'une unité (proprietes incluant coproprietaire)
export function nomsProprietaires(unite) {
  return enCours(unite.proprietes).map((p) => p.coproprietaire?.nom).filter(Boolean).join(", ");
}

// ---------- Compte d'une unité ----------

export function soldeUnite({ charges = [], paiements = [] }) {
  const du = charges.reduce((s, c) => s + c.montant, 0);
  const paye = paiements.reduce((s, p) => s + p.montant, 0);
  return arrondi(du - paye);
}

// Relevé chronologique : charges (+) et paiements (−), avec solde courant
export function releveUnite({ charges = [], paiements = [] }) {
  const lignes = [
    ...charges.map((c) => ({ id: c.id, genre: "charge", date: c.date, type: c.type, libelle: c.description || libelle(TYPES_CHARGE, c.type), montant: c.montant })),
    ...paiements.map((p) => ({ id: p.id, genre: "paiement", date: p.date, mode: p.mode, libelle: [libelle(MODES_PAIEMENT, p.mode), p.reference].filter((x) => x && x !== "—").join(" · ") || "Paiement", montant: -p.montant })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.genre === "charge" ? -1 : 1));
  let solde = 0;
  for (const l of lignes) {
    solde = arrondi(solde + l.montant);
    l.solde = solde;
  }
  return lignes;
}

// ---------- Budget et répartition des charges ----------

export const totalBudget = (b) => arrondi((b?.chargesCourantes || 0) + (b?.fondsPrevoyance || 0) + (b?.fondsAutoAssurance || 0));

// Part de chaque unité dans le budget annuel, selon sa quote-part (valeur
// relative). Les quotes-parts devraient totaliser 100 % ; sinon, la
// répartition se fait au prorata du total réel, pour que tout le budget soit
// réparti, et l'écart est signalé.
export function repartitionBudget(budget, unites) {
  const totalQp = unites.reduce((s, u) => s + (u.quotePart || 0), 0);
  const total = totalBudget(budget);
  const lignes = unites.map((u) => {
    const ratio = totalQp > 0 ? (u.quotePart || 0) / totalQp : 0;
    const annuel = arrondi(total * ratio);
    return {
      uniteId: u.id,
      numero: u.numero,
      quotePart: u.quotePart || 0,
      charges: arrondi((budget?.chargesCourantes || 0) * ratio),
      prevoyance: arrondi((budget?.fondsPrevoyance || 0) * ratio),
      autoAssurance: arrondi((budget?.fondsAutoAssurance || 0) * ratio),
      annuel,
      mensuel: arrondi(annuel / 12),
    };
  });
  return { lignes, totalQp: Math.round(totalQp * 10000) / 10000, total, ecartQp: Math.abs(totalQp - 100) > 0.001 };
}

// Le fonds de prévoyance doit recevoir au moins 5 % des charges courantes
// (Code civil du Québec, art. 1071) — tant que l'étude du fonds n'en exige
// pas plus
export function prevoyanceSuffisante(budget) {
  if (!budget?.chargesCourantes) return true;
  return (budget.fondsPrevoyance || 0) >= budget.chargesCourantes * 0.05 - 0.005;
}

// Budget en vigueur pour une période « 2026-11 » : l'exercice qui la couvre
export function budgetPourPeriode(budgets, periode) {
  const [a, m] = periode.split("-").map(Number);
  const rang = a * 12 + (m - 1);
  return budgets.find((b) => {
    const debut = b.annee * 12 + ((b.moisDebut || 1) - 1);
    return rang >= debut && rang < debut + 12;
  }) || null;
}

export function periodeLisible(periode) {
  if (!periode) return "";
  const [a, m] = periode.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 15)));
}

// ---------- Entretien préventif ----------

// Date + n mois, « 2026-11-05 » → « 2027-11-05 » (fin de mois ramenée au
// dernier jour du mois visé)
export function ajouterMois(date, n) {
  const d = new Date(date);
  const jour = d.getUTCDate();
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12));
  const dernier = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(jour, dernier));
  return r;
}

// Échéance d'un entretien : en retard, ce mois-ci (30 jours) ou plus tard
export function etatEcheance(prochaineDate, aujourdhui = new Date()) {
  const jours = Math.floor((new Date(prochaineDate) - aujourdhui) / 86400000);
  if (jours < 0) return { code: "RETARD", label: `En retard de ${-jours} j`, couleur: "#C2453B", jours };
  if (jours <= 30) return { code: "BIENTOT", label: jours === 0 ? "Aujourd'hui" : `Dans ${jours} j`, couleur: "#D98A2B", jours };
  return { code: "PLUS_TARD", label: `Dans ${jours} j`, couleur: "#6FA96B", jours };
}

export function frequenceLisible(mois) {
  if (mois === 1) return "Chaque mois";
  if (mois === 12) return "Chaque année";
  if (mois % 12 === 0) return `Aux ${mois / 12} ans`;
  return `Aux ${mois} mois`;
}

// Taille d'un fichier : « 1,2 Mo »
export function taille(octets) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}
