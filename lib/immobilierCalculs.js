// Listes et calculs de l'immobilier locatif (module « Immobilier », voir
// lib/immobilier.js) — sans accès à la base, donc utilisables aussi dans les
// composants du navigateur.

export { argent } from "./format";
export { libelle, trouver, dateCourte, dateLisible, taille, periodeLisible, ajouterMois } from "./coproprieteCalculs";
import { libelle, ajouterMois } from "./coproprieteCalculs";

export const TYPES_IMMEUBLE = [
  { code: "MAISON", label: "Maison / unifamiliale", icone: "🏡" },
  { code: "PLEX", label: "Plex (duplex à quintuplex)", icone: "🏘️" },
  { code: "MULTILOGEMENT", label: "Multilogement (6 logements et +)", icone: "🏢" },
  { code: "MIXTE", label: "Mixte (commerces et logements)", icone: "🏬" },
  { code: "COMMERCIAL", label: "Commercial", icone: "🏪" },
  { code: "AUTRE", label: "Autre", icone: "▫️" },
];

export const TYPES_LOGEMENT = [
  { code: "LOGEMENT", label: "Logement", icone: "🏠" },
  { code: "COMMERCIAL", label: "Local commercial", icone: "🏪" },
  { code: "STATIONNEMENT", label: "Stationnement", icone: "🅿️" },
  { code: "RANGEMENT", label: "Rangement", icone: "📦" },
  { code: "AUTRE", label: "Autre", icone: "▫️" },
];

// Ce que le loyer comprend (section du bail sur les services et conditions)
export const SERVICES_BAIL = [
  { code: "CHAUFFAGE", label: "Chauffage" },
  { code: "EAU_CHAUDE", label: "Eau chaude" },
  { code: "ELECTRICITE", label: "Électricité" },
  { code: "ELECTROMENAGERS", label: "Électroménagers" },
  { code: "LAVEUSE_SECHEUSE", label: "Laveuse et sécheuse" },
  { code: "STATIONNEMENT", label: "Stationnement" },
  { code: "RANGEMENT", label: "Rangement" },
  { code: "INTERNET", label: "Internet" },
  { code: "MEUBLE", label: "Meublé" },
  { code: "DENEIGEMENT", label: "Déneigement" },
];

export const STATUTS_BAIL = [
  { code: "ACTIF", label: "En cours", couleur: "#6FA96B" },
  { code: "TERMINE", label: "Terminé", couleur: "#8A8579" },
  { code: "RESILIE", label: "Résilié", couleur: "#C2453B" },
];

export const REPONSES_AVIS = [
  { code: "ACCEPTE", label: "Accepte la modification" },
  { code: "REFUSE", label: "Refuse la modification (reste)" },
  { code: "QUITTE", label: "Quitte à la fin du bail" },
];

export const TYPES_CHARGE = [
  { code: "LOYER", label: "Loyer du mois" },
  { code: "FRAIS", label: "Frais (chèque sans provision, clé…)" },
  { code: "AUTRE", label: "Autre" },
];

export const MODES_PAIEMENT = [
  { code: "VIREMENT", label: "Virement / Interac" },
  { code: "CHEQUE", label: "Chèque" },
  { code: "PREAUTORISE", label: "Prélèvement préautorisé" },
  { code: "COMPTANT", label: "Comptant" },
  { code: "AUTRE", label: "Autre" },
];

export const CATEGORIES_DEPENSE = [
  { code: "TAXES_MUNICIPALES", label: "Taxes municipales", icone: "🏛️" },
  { code: "TAXES_SCOLAIRES", label: "Taxe scolaire", icone: "🎒" },
  { code: "ASSURANCE", label: "Assurance", icone: "🛡️" },
  { code: "INTERETS", label: "Intérêts hypothécaires", icone: "🏦" },
  { code: "ELECTRICITE", label: "Électricité (aires communes)", icone: "💡" },
  { code: "CHAUFFAGE", label: "Chauffage", icone: "🔥" },
  { code: "ENTRETIEN", label: "Entretien courant, ménage", icone: "🧹" },
  { code: "DENEIGEMENT", label: "Déneigement, paysagement", icone: "❄️" },
  { code: "GESTION", label: "Gestion, publicité, frais bancaires", icone: "📣" },
  { code: "HONORAIRES", label: "Honoraires (comptable, notaire, avocat)", icone: "⚖️" },
  { code: "AUTRE", label: "Autre", icone: "▫️" },
];

export const CATEGORIES_REPARATION = [
  { code: "PLOMBERIE", label: "Plomberie" },
  { code: "ELECTRICITE", label: "Électricité" },
  { code: "CHAUFFAGE", label: "Chauffage, climatisation" },
  { code: "ELECTROMENAGERS", label: "Électroménagers" },
  { code: "TOITURE", label: "Toiture" },
  { code: "ENVELOPPE", label: "Fenêtres, portes, balcons, revêtement" },
  { code: "STRUCTURE", label: "Structure, fondation" },
  { code: "PEINTURE", label: "Peinture, planchers, finition" },
  { code: "PARASITES", label: "Extermination" },
  { code: "TERRAIN", label: "Terrain, stationnement" },
  { code: "SECURITE", label: "Détecteurs, sécurité incendie" },
  { code: "AUTRE", label: "Autre" },
];

export const PRIORITES = [
  { code: "URGENTE", label: "Urgente", couleur: "#C2453B", rang: 0 },
  { code: "HAUTE", label: "Haute", couleur: "#D98A2B", rang: 1 },
  { code: "NORMALE", label: "Normale", couleur: "#5B8FD1", rang: 2 },
  { code: "BASSE", label: "Basse", couleur: "#8A8579", rang: 3 },
];

export const STATUTS_REPARATION = [
  { code: "NOUVELLE", label: "Nouvelle", couleur: "#D98A2B", ouverte: true },
  { code: "PLANIFIEE", label: "Planifiée", couleur: "#5B8FD1", ouverte: true },
  { code: "EN_COURS", label: "En cours", couleur: "#8C6BC4", ouverte: true },
  { code: "TERMINEE", label: "Terminée", couleur: "#6FA96B", ouverte: false },
  { code: "ANNULEE", label: "Annulée", couleur: "#8A8579", ouverte: false },
];
export const STATUTS_REPARATION_OUVERTS = STATUTS_REPARATION.filter((s) => s.ouverte).map((s) => s.code);

export const CATEGORIES_DOCUMENTS = [
  { code: "BAIL", label: "Baux signés", icone: "✍️" },
  { code: "AVIS", label: "Avis (modification, reconduction, entrée…)", icone: "📣" },
  { code: "ETAT_LIEUX", label: "États des lieux et photos", icone: "📷" },
  { code: "LOCATAIRE", label: "Dossiers des locataires (enquête, références)", icone: "🧑" },
  { code: "ASSURANCE", label: "Assurances", icone: "🛡️" },
  { code: "TAXES", label: "Comptes de taxes", icone: "🏛️" },
  { code: "HYPOTHEQUE", label: "Hypothèque, financement", icone: "🏦" },
  { code: "ACTE", label: "Actes de vente, certificat de localisation", icone: "⚖️" },
  { code: "INSPECTION", label: "Inspections, rapports", icone: "🔍" },
  { code: "CONTRATS", label: "Contrats (déneigement, entretien…)", icone: "🤝" },
  { code: "GARANTIES", label: "Garanties, factures de travaux", icone: "🧾" },
  { code: "PLANS", label: "Plans", icone: "📐" },
  { code: "AUTRE", label: "Autres", icone: "🗂️" },
];

const arrondi = (n) => Math.round(n * 100) / 100;
const JOUR = 86400000;

// Date enregistrée à midi UTC → « jour » comparable
const jourDe = (d) => Math.floor(new Date(d).getTime() / JOUR);

export const servicesListe = (services) => String(services || "").split(",").map((s) => s.trim()).filter(Boolean);
export const servicesLisibles = (services) => servicesListe(services).map((c) => libelle(SERVICES_BAIL, c)).join(", ");

// « Marie Tremblay et Luc Gagnon »
export function nomsLocataires(bail) {
  const noms = (bail?.locataires || []).map((l) => l.nom);
  if (noms.length <= 1) return noms[0] || "";
  return `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}`;
}

// « Logement 314 », « Local A », « Stationnement P-3 »
export function nomLogement(l) {
  if (!l) return "";
  const type = TYPES_LOGEMENT.find((t) => t.code === l.type);
  return l.type === "LOGEMENT" || !type ? `Logement ${l.numero}` : /^local/i.test(l.numero) ? l.numero : `${type.label} ${l.numero}`;
}

// Adresse complète d'un logement : « 312-316 rue Champlain, logement 314, Saint-Jean-sur-Richelieu (Québec) J3B 6V5 »
export function adresseLogement(logement) {
  const i = logement?.immeuble || {};
  const ville = [i.ville, i.ville ? "(Québec)" : null, i.codePostal].filter(Boolean).join(" ");
  // Logement d'un plex avec sa propre adresse civique : « 314 rue Champlain »
  if (logement?.adresseCivique) return [logement.adresseCivique, ville].filter(Boolean).join(", ");
  return [i.adresse || i.nom, nomLogement(logement).replace(/^Logement/, "logement"), ville].filter(Boolean).join(", ");
}

// Bail en cours d'un logement (le plus récent des baux ACTIF)
export function bailActuel(logement) {
  const actifs = (logement?.baux || []).filter((b) => b.statut === "ACTIF");
  return actifs.sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut))[0] || null;
}

// ---------- Compte d'un bail ----------

export function soldeBail({ charges = [], paiements = [] }) {
  return arrondi(charges.reduce((s, c) => s + c.montant, 0) - paiements.reduce((s, p) => s + p.montant, 0));
}

// Relevé chronologique : charges (+) et paiements (−), avec solde courant
export function releveBail({ charges = [], paiements = [] }) {
  const lignes = [
    ...charges.map((c) => ({ id: c.id, genre: "charge", date: c.date, libelle: c.description || libelle(TYPES_CHARGE, c.type), montant: c.montant })),
    ...paiements.map((p) => ({ id: p.id, genre: "paiement", date: p.date, libelle: [libelle(MODES_PAIEMENT, p.mode), p.reference].filter((x) => x && x !== "—").join(" · ") || "Paiement", montant: -p.montant })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date) || (a.genre === "charge" ? -1 : 1));
  let solde = 0;
  for (const l of lignes) {
    solde = arrondi(solde + l.montant);
    l.solde = solde;
  }
  return lignes;
}

// Loyer dû pour un mois « 2026-11 » : loyer complet, ou au prorata des jours
// couverts quand le bail commence ou finit en cours de mois. 0 si le bail ne
// couvre pas ce mois.
export function loyerDuMois(bail, periode) {
  const [a, m] = periode.split("-").map(Number);
  const debutMois = Date.UTC(a, m - 1, 1) / JOUR;
  const nbJours = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const finMois = debutMois + nbJours - 1;
  const debut = Math.max(debutMois, jourDe(bail.dateDebut));
  const fin = Math.min(finMois, bail.dateFin ? jourDe(bail.dateFin) : finMois);
  if (fin < debut) return 0;
  const jours = fin - debut + 1;
  return jours >= nbJours ? arrondi(bail.loyer) : arrondi((bail.loyer * jours) / nbJours);
}

// ---------- Fin du bail et avis (règles du Tribunal administratif du logement) ----------
//
// Au Québec, le bail se reconduit de plein droit aux mêmes conditions. Pour
// en modifier le loyer ou une condition, le locateur envoie un avis de
// modification :
//   • bail de 12 mois ou plus : entre 6 et 3 mois avant la fin ;
//   • bail de moins de 12 mois : entre 2 et 1 mois avant la fin ;
//   • durée indéterminée : entre 2 et 1 mois avant la modification.
// Le locataire a ensuite un mois pour répondre (accepter, refuser, quitter) ;
// son silence vaut acceptation.

export function dureeMois(bail) {
  if (!bail.dateFin) return null;
  const d = new Date(bail.dateDebut);
  const f = new Date(new Date(bail.dateFin).getTime() + JOUR); // lendemain de la fin
  return (f.getUTCFullYear() - d.getUTCFullYear()) * 12 + (f.getUTCMonth() - d.getUTCMonth()) + (f.getUTCDate() >= d.getUTCDate() ? 0 : -1);
}

// Période où l'avis de modification doit être envoyé → { debut, fin } ou null (durée indéterminée)
export function fenetreAvis(bail) {
  if (!bail.dateFin) return null;
  const longue = (dureeMois(bail) ?? 12) >= 12;
  const lendemain = new Date(new Date(bail.dateFin).getTime() + JOUR);
  return { debut: ajouterMois(lendemain, longue ? -6 : -2), fin: ajouterMois(lendemain, longue ? -3 : -1), longue };
}

// Où en est la fin d'un bail actif, du point de vue du propriétaire :
//   INDETERMINEE · PLUS_TARD (avis pas encore permis) · AVIS_A_ENVOYER
//   (fenêtre ouverte) · AVIS_ENVOYE (en attente de réponse ou répondu) ·
//   RECONDUIT (fenêtre passée sans avis : mêmes conditions) · ECHU (date de
//   fin passée, bail encore « en cours » : à renouveler ou à terminer)
export function etatFinBail(bail, maintenant = new Date()) {
  if (bail.statut !== "ACTIF") return { code: "FERME", label: libelle(STATUTS_BAIL, bail.statut), couleur: "#8A8579" };
  if (!bail.dateFin) return { code: "INDETERMINEE", label: "Durée indéterminée", couleur: "#8A8579" };
  const aujourdhui = jourDe(maintenant);
  const fin = jourDe(bail.dateFin);
  const joursAvantFin = fin - aujourdhui;
  if (joursAvantFin < 0) return { code: "ECHU", label: `Fin dépassée de ${-joursAvantFin} j : renouveler ou terminer`, couleur: "#C2453B", joursAvantFin };
  const f = fenetreAvis(bail);
  if (bail.avisEnvoyeLe) {
    const reponse = bail.reponseAvis ? libelle(REPONSES_AVIS, bail.reponseAvis) : "réponse attendue";
    return { code: "AVIS_ENVOYE", label: `Avis envoyé · ${reponse}`, couleur: bail.reponseAvis === "QUITTE" ? "#D98A2B" : "#5B8FD1", joursAvantFin, fenetre: f };
  }
  if (aujourdhui < jourDe(f.debut)) return { code: "PLUS_TARD", label: `Fin dans ${joursAvantFin} j`, couleur: "#6FA96B", joursAvantFin, fenetre: f };
  if (aujourdhui <= jourDe(f.fin)) {
    const reste = jourDe(f.fin) - aujourdhui;
    return { code: "AVIS_A_ENVOYER", label: `Avis de modification à envoyer — reste ${reste} j`, couleur: "#D98A2B", joursAvantFin, fenetre: f, reste };
  }
  return { code: "RECONDUIT", label: "Délai d'avis passé : reconduit aux mêmes conditions", couleur: "#8A8579", joursAvantFin, fenetre: f };
}

// Augmentation proposée : « +25 $ (2,5 %) »
export function hausseLisible(ancien, nouveau) {
  if (!ancien || nouveau == null) return "";
  const diff = arrondi(nouveau - ancien);
  const pc = ((diff / ancien) * 100).toFixed(1).replace(".", ",");
  return `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(2).replace(".", ",")} $ (${diff >= 0 ? "+" : "−"}${pc.replace("-", "")} %)`;
}

// Bail suivant au renouvellement : même durée, au lendemain de la fin
export function datesRenouvellement(bail) {
  const debut = new Date(new Date(bail.dateFin).getTime() + JOUR);
  const duree = dureeMois(bail) || 12;
  const fin = new Date(ajouterMois(debut, duree).getTime() - JOUR);
  return { dateDebut: debut, dateFin: fin };
}

// ---------- Rendement d'un immeuble ----------

// Revenus et dépenses d'une liste d'immeubles pour une année :
// immeubles [{ id, nom, logements: [{ baux: [{ loyer, statut, charges, paiements }] }] }],
// depenses [{ immeubleId, montant, categorie }], reparations [{ immeubleId, coutReel }]
export function rendement({ immeubles, charges, paiements, depenses, reparations }) {
  const lignes = immeubles.map((i) => ({ id: i.id, nom: i.nom, facture: 0, percu: 0, depenses: 0, reparations: 0 }));
  const parId = Object.fromEntries(lignes.map((l) => [l.id, l]));
  for (const c of charges) if (parId[c.immeubleId]) parId[c.immeubleId].facture += c.montant;
  for (const p of paiements) if (parId[p.immeubleId]) parId[p.immeubleId].percu += p.montant;
  for (const d of depenses) if (parId[d.immeubleId]) parId[d.immeubleId].depenses += d.montant;
  for (const r of reparations) if (parId[r.immeubleId]) parId[r.immeubleId].reparations += r.coutReel || 0;
  for (const l of lignes) {
    for (const k of ["facture", "percu", "depenses", "reparations"]) l[k] = arrondi(l[k]);
    l.net = arrondi(l.percu - l.depenses - l.reparations);
  }
  const total = lignes.reduce((t, l) => {
    for (const k of ["facture", "percu", "depenses", "reparations", "net"]) t[k] = arrondi(t[k] + l[k]);
    return t;
  }, { facture: 0, percu: 0, depenses: 0, reparations: 0, net: 0 });
  return { lignes, total };
}

// Taux d'occupation (%) : logements avec un bail en cours / logements
export function tauxOccupation(logements) {
  if (logements.length === 0) return 0;
  return Math.round((logements.filter((l) => bailActuel(l)).length / logements.length) * 1000) / 10;
}

// Échéance d'un document (assurance, contrat) : expiré ou dans 60 jours
export function etatExpiration(expireLe, maintenant = new Date()) {
  if (!expireLe) return null;
  const jours = jourDe(expireLe) - jourDe(maintenant);
  if (jours < 0) return { code: "EXPIRE", label: `Expiré depuis ${-jours} j`, couleur: "#C2453B", jours };
  if (jours <= 60) return { code: "BIENTOT", label: `Expire dans ${jours} j`, couleur: "#D98A2B", jours };
  return { code: "OK", label: "En vigueur", couleur: "#6FA96B", jours };
}

// Mois « 2026-11 » courant au Québec
export function periodeCourante() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date()).slice(0, 7);
}

// ---------- Relevé 31 (Revenu Québec) ----------
//
// Le propriétaire d'un logement pour lequel un loyer était payé ou payable
// le 31 décembre produit un relevé 31 par logement : case A, le numéro du
// logement que Revenu Québec détermine ; case B, le nombre de locataires et
// sous-locataires qui ont signé le bail ; case C, l'adresse du logement (C1
// appartement, C2 numéro municipal, C3 rue, C4 ville, C5 code postal) ; et le
// nom des locataires. Chaque locataire en reçoit une copie. À transmettre au
// plus tard le dernier jour de février de l'année suivante — par Internet
// dès qu'il y en a plus de 5 (service en ligne de Revenu Québec).

const finAnnee = (annee) => Date.UTC(annee, 11, 31) / JOUR;

// Bail qui couvre le 31 décembre de l'année (loyer payé ou payable ce jour-là)
export function bailAu31Decembre(bail, annee) {
  const j = finAnnee(annee);
  if (jourDe(bail.dateDebut) > j) return false;
  if (bail.dateFin && jourDe(bail.dateFin) < j) return false;
  if (bail.terminaisonLe && jourDe(bail.terminaisonLe) < j) return false;
  return true;
}

// Le relevé 31 vise les logements (pas les locaux commerciaux, stationnements ni rangements)
export const logementVise = (logement) => logement?.type === "LOGEMENT";

// Date limite : dernier jour de février de l'année suivante
export function echeanceReleve31(annee) {
  return new Date(Date.UTC(annee + 1, 2, 0, 12));
}

// « 312-316 rue Champlain » → { numero: "312-316", rue: "rue Champlain" }
export function decouperAdresseCivique(adresse) {
  const m = /^\s*(\d+[A-Za-z]?(?:\s*[-–]\s*\d+[A-Za-z]?)?)\s*,?\s+(.+?)\s*$/.exec(adresse || "");
  return m ? { numero: m[1].replace(/\s+/g, ""), rue: m[2] } : { numero: "", rue: (adresse || "").trim() };
}

// Données du relevé 31 d'un bail (bail avec locataires, logement.immeuble)
// → { caseA, caseB, c1…c5, locataires, problemes }
export function donneesReleve31(bail) {
  const l = bail.logement;
  const i = l.immeuble || {};
  const propre = Boolean(l.adresseCivique);
  const { numero, rue } = decouperAdresseCivique(l.adresseCivique || i.adresse);
  const d = {
    caseA: l.numeroLogementRq || "",
    caseB: bail.locataires.length,
    c1: propre ? "" : l.numero,
    c2: numero,
    c3: rue,
    c4: i.ville || "",
    c5: i.codePostal || "",
    locataires: bail.locataires.map((x) => x.nom),
  };
  const problemes = [];
  if (!d.caseA) problemes.push("Numéro de logement (case A) à inscrire");
  if (!d.c2 || !d.c3) problemes.push("Numéro municipal ou rue manquant");
  if (!d.c4 || !d.c5) problemes.push("Ville ou code postal manquant");
  if (!propre && /[-–]/.test(d.c2)) problemes.push("L'immeuble a plusieurs numéros civiques : indique l'adresse du logement");
  if (d.caseB === 0) problemes.push("Aucun locataire inscrit au bail");
  return { ...d, problemes };
}
