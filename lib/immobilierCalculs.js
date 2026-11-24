// Listes et calculs de l'immobilier locatif (module « Immobilier », voir
// lib/immobilier.js) — sans accès à la base, donc utilisables aussi dans les
// composants du navigateur.

export { argent } from "./format";
export { libelle, trouver, dateCourte, dateLisible, taille, periodeLisible, ajouterMois, etatEcheance, frequenceLisible, TYPES_ENTRETIEN } from "./coproprieteCalculs";
import { libelle, ajouterMois, dateLisible, etatEcheance, frequenceLisible } from "./coproprieteCalculs";
import { argent } from "./format";

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

// Mentions du bail complet (sections du formulaire du TAL)
export const CHAUFFAGES = [
  { code: "ELECTRICITE", label: "Électricité" },
  { code: "GAZ", label: "Gaz" },
  { code: "MAZOUT", label: "Mazout" },
  { code: "BIENERGIE", label: "Biénergie" },
  { code: "AUTRE", label: "Autre" },
];

export const ANIMAUX = [
  { code: "PERMIS", label: "Permis" },
  { code: "CONDITIONS", label: "Permis selon les conditions du bail ou du règlement" },
  { code: "INTERDITS", label: "Interdits" },
];

export const FUMEUR = [
  { code: "INTERDIT", label: "Interdit de fumer (tabac et cannabis) dans le logement et les aires communes" },
  { code: "BALCON", label: "Interdit dans le logement, permis sur le balcon ou le terrain" },
  { code: "PERMIS", label: "Permis dans le logement" },
];

// ---------- Signature électronique (lib/signatureImmo.js) ----------

export const STATUTS_SIGNATURE = [
  { code: "EN_ATTENTE", label: "En attente", couleur: "#D98A2B" },
  { code: "SIGNE", label: "Signé", couleur: "#6FA96B" },
  { code: "REFUSE", label: "Refusé", couleur: "#C2453B" },
  { code: "ANNULE", label: "Annulé", couleur: "#8A8579" },
];

// État d'ensemble des signatures d'un document (les demandes annulées ne
// comptent pas) → null s'il n'y en a pas, sinon { code, label, couleur, signees, total }
export function etatSignatures(signatures = []) {
  const actives = signatures.filter((s) => s.statut !== "ANNULE");
  if (actives.length === 0) return null;
  const signees = actives.filter((s) => s.statut === "SIGNE").length;
  const total = actives.length;
  if (actives.some((s) => s.statut === "REFUSE")) return { code: "REFUSE", label: "Signature refusée", couleur: "#C2453B", signees, total };
  if (signees === total) return { code: "SIGNE", label: total > 1 ? `Signé par les ${total} parties` : "Signé", couleur: "#6FA96B", signees, total };
  return { code: "EN_ATTENTE", label: `À signer — ${signees}/${total}`, couleur: "#D98A2B", signees, total };
}

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
  // Travaux majeurs ou achat durable : amorti à l'impôt, pas déduit d'un coup
  { code: "IMMOBILISATION", label: "Travaux majeurs, achat durable (immobilisation)", icone: "🏗️" },
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

// ---------- Retards ----------
//
// Un loyer inscrit n'est pas « en retard » le jour où il est inscrit : il est
// d'abord « à recevoir », jusqu'à son échéance (le jour de paiement du bail),
// puis en retard à partir du lendemain. Les paiements et les crédits
// s'imputent au plus ancien montant dû. Le locataire en retard de plus de
// trois semaines pour le paiement du loyer s'expose à la résiliation du bail
// par le Tribunal administratif du logement (art. 1971 C.c.Q.).

export const JOURS_RETARD_TAL = 21;

// « Aujourd'hui » au Québec, comparable à jourDe() d'une date enregistrée
export function jourQuebec(maintenant = new Date()) {
  const [a, m, j] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(maintenant).split("-").map(Number);
  return Date.UTC(a, m - 1, j) / JOUR;
}

// Montant du compte dont l'échéance est passée (en retard s'il est impayé)
export const chargeEchue = (c, maintenant = new Date()) => jourDe(c.date) < jourQuebec(maintenant);

// État du compte d'un bail : charges [{ date, montant }], paiements [{ montant }]
// → { solde, enRetard, aRecevoir, joursRetard, depuis, tal }
//   enRetard : dû dont l'échéance est passée ; aRecevoir : le reste du solde
//   (loyer inscrit d'avance, ou dû aujourd'hui) ; depuis : échéance du plus
//   ancien montant impayé ; tal : retard de plus de trois semaines
export function etatCompte({ charges = [], paiements = [] }, maintenant = new Date()) {
  const auj = jourQuebec(maintenant);
  const solde = soldeBail({ charges, paiements });
  const echues = charges.filter((c) => chargeEchue(c, maintenant)).sort((a, b) => new Date(a.date) - new Date(b.date));
  // Ce qui couvre les montants dus : paiements, et crédits déjà au compte
  const couvert = paiements.reduce((s, p) => s + p.montant, 0) + echues.filter((c) => c.montant < 0).reduce((s, c) => s - c.montant, 0);
  const totalEchu = echues.filter((c) => c.montant > 0).reduce((s, c) => s + c.montant, 0);
  const enRetard = Math.min(Math.max(0, arrondi(totalEchu - couvert)), Math.max(0, solde));
  let depuis = null;
  if (enRetard > 0.005) {
    let cumul = 0;
    for (const c of echues) {
      if (c.montant <= 0) continue;
      cumul += c.montant;
      if (cumul - couvert > 0.005) { depuis = c.date; break; }
    }
  }
  const joursRetard = depuis ? auj - jourDe(depuis) : 0;
  return {
    solde,
    enRetard: enRetard > 0.005 ? enRetard : 0,
    aRecevoir: Math.max(0, arrondi(solde - enRetard)),
    joursRetard,
    depuis,
    tal: joursRetard > JOURS_RETARD_TAL,
  };
}

// Pastille d'un compte en retard → { label, couleur } ou null
export function etatRetard(compte) {
  if (!compte || compte.enRetard <= 0.005) return null;
  const j = compte.joursRetard;
  if (compte.tal) return { code: "TAL", label: `${j} j de retard · plus de 3 sem.`, couleur: "#C2453B" };
  return { code: "RETARD", label: `${j} j de retard`, couleur: "#D98A2B" };
}

// Comptes de plusieurs baux additionnés (fiche d'un locataire)
export function additionnerComptes(comptes) {
  return comptes.filter(Boolean).reduce((t, c) => ({
    solde: arrondi(t.solde + c.solde),
    enRetard: arrondi(t.enRetard + c.enRetard),
    aRecevoir: arrondi(t.aRecevoir + c.aRecevoir),
    joursRetard: Math.max(t.joursRetard, c.joursRetard),
    tal: t.tal || c.tal,
  }), { solde: 0, enRetard: 0, aRecevoir: 0, joursRetard: 0, tal: false });
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

// Fin du délai de réponse à l'avis de modification : un mois après sa
// réception, comptée ici cinq jours après l'envoi. Sans réponse, le
// locataire est réputé accepter la modification.
export const JOURS_LIVRAISON_AVIS = 5;
export function finReponseAvis(bail) {
  if (!bail?.avisEnvoyeLe) return null;
  return new Date(ajouterMois(bail.avisEnvoyeLe, 1).getTime() + JOURS_LIVRAISON_AVIS * JOUR);
}

// Renouvellement à inscrire dans l'appli : dans les 30 jours avant la fin
// (sinon les loyers des mois suivants ne s'inscrivent plus)
const JOURS_AVANT_RENOUVELLEMENT = 30;

// Ce qui demande une action pour un bail en cours (tableau de bord, avis au
// propriétaire — lib/immobilierAuto.js). bail : avec logement.immeuble et
// locataires ; compte : etatCompte() du bail.
// → [{ cle, code, niveau (0 urgent · 1 à faire · 2 à prévoir), quoi, detail, href, aviser }]
// cle : unique pour cette situation (date comprise), pour n'aviser qu'une fois
export function aSurveillerBail(bail, compte, maintenant = new Date()) {
  if (bail.statut !== "ACTIF") return [];
  const items = [];
  const href = `/immobilier/baux/${bail.id}`;
  const ajouter = (code, niveau, quoi, detail, cleDate, aviser = true) => items.push({ cle: `${bail.id}:${code}:${cleDate ? new Date(cleDate).toISOString().slice(0, 10) : ""}`, code, niveau, quoi, detail, href, aviser, bailId: bail.id });
  const etat = etatFinBail(bail, maintenant);
  const fin = bail.dateFin && dateLisible(bail.dateFin);

  if (compte?.tal) ajouter("TAL", 0, "Loyer en retard de plus de 3 semaines", `${argent(compte.enRetard)} depuis ${compte.joursRetard} j — motif de résiliation au TAL`, compte.depuis);
  if (etat.code === "ECHU") ajouter("ECHU", 0, "Bail échu : renouveler ou terminer", `fin le ${fin} — les loyers ne s'inscrivent plus`, bail.dateFin);
  if (etat.code === "AVIS_A_ENVOYER") {
    const detail = `au plus tard le ${dateLisible(etat.fenetre.fin)} (reste ${etat.reste} j)${bail.nouveauLoyer != null ? ` · ${hausseLisible(bail.loyer, bail.nouveauLoyer)}` : ""}`;
    // Avisé à l'ouverture de la période, puis de nouveau 15 jours avant sa fin
    ajouter(etat.reste <= 15 ? "AVIS15" : "AVIS", etat.reste <= 15 ? 0 : 1, "Avis de modification à envoyer", detail, etat.fenetre.fin);
  }
  if (etat.code === "AVIS_ENVOYE") {
    const finReponse = finReponseAvis(bail);
    if (!bail.reponseAvis && finReponse && jourDe(maintenant) >= jourDe(finReponse)) {
      ajouter("REPONSE", 1, "Avis sans réponse : réputé accepté", `avis du ${dateLisible(bail.avisEnvoyeLe)}, délai d'un mois passé — inscris la réponse « Accepte »`, bail.avisEnvoyeLe);
    }
    // Refus : le locateur a un mois depuis sa réception pour demander au TAL
    // de fixer le loyer (date du refus signé en ligne, sinon fin du délai de réponse)
    const limiteRefus = bail.reponseAvis === "REFUSE" && ajouterMois(bail.reponseAvisLe || finReponse || bail.avisEnvoyeLe, 1);
    if (limiteRefus && jourDe(maintenant) <= jourDe(limiteRefus)) {
      ajouter("REFUS", 1, "Modification refusée par le locataire", `pour garder la hausse, demande au TAL de fixer le loyer d'ici le ${dateLisible(limiteRefus)}`, bail.avisEnvoyeLe);
    }
    if (bail.reponseAvis === "QUITTE") ajouter("QUITTE", 2, "Départ à la fin du bail : logement à relouer", `fin le ${fin}`, bail.dateFin, false);
  }
  if (etat.joursAvantFin != null && etat.joursAvantFin >= 0 && etat.joursAvantFin <= JOURS_AVANT_RENOUVELLEMENT && bail.reponseAvis !== "QUITTE") {
    const loyer = bail.reponseAvis === "ACCEPTE" || (!bail.reponseAvis && bail.avisEnvoyeLe) ? bail.nouveauLoyer ?? bail.loyer : bail.loyer;
    ajouter("RENOUVELER", 2, "Renouveler le bail dans l'appli", `fin le ${fin} · bail suivant à ${argent(loyer)}`, bail.dateFin);
  }
  return items;
}

// Bail suivant au renouvellement : même durée, au lendemain de la fin
export function datesRenouvellement(bail) {
  const debut = new Date(new Date(bail.dateFin).getTime() + JOUR);
  const duree = dureeMois(bail) || 12;
  const fin = new Date(ajouterMois(debut, duree).getTime() - JOUR);
  return { dateDebut: debut, dateFin: fin };
}

// ---------- Hausse de loyer selon la méthode du TAL ----------
//
// Méthode du Règlement sur les critères de fixation de loyer pour les avis
// de modification donnés depuis le 1er janvier 2026 (décret 1455-2025) :
//   1. le pourcentage de base publié par le TAL chaque janvier (moyenne sur
//      trois ans de l'IPC du Québec), appliqué au loyer actuel ;
//   2. taxes municipales et scolaires de l'immeuble : seule la part de leur
//      hausse qui dépasse le pourcentage de base, au prorata du logement,
//      divisée par 12 ;
//   3. assurances de l'immeuble : de même ;
//   4. dépenses d'immobilisation (travaux majeurs, aides et subventions
//      déduites) : 5 % de la dépense, divisés par 12 — au prorata du logement
//      pour des travaux de l'immeuble, en entier pour ceux du logement.
// C'est une estimation : seul le TAL fixe le loyer quand le locataire refuse
// la hausse, et son outil de calcul fait foi.

// Pourcentages de base publiés par le TAL, par période : la clé 2026 vaut
// pour les baux qui commencent du 2 avril 2026 au 1er avril 2027. Ajouter
// chaque année le taux publié vers la mi-janvier. Un taux pas encore publié
// peut être inscrit dans l'appli (réglage immo_pourcentages_tal) ; un taux
// d'ici a priorité sur lui.
export const POURCENTAGES_BASE_TAL = { 2026: 3.1 };
export const POURCENTAGE_IMMOBILISATIONS_TAL = 5;

// Période du TAL d'un bail qui commence à cette date : 2026 du 2 avril 2026 au 1er avril 2027
export function periodeTal(debut) {
  const d = new Date(debut);
  const a = d.getUTCFullYear();
  const avant2Avril = d.getUTCMonth() < 3 || (d.getUTCMonth() === 3 && d.getUTCDate() < 2);
  return avant2Avril ? a - 1 : a;
}

// « du 2 avril 2027 au 1er avril 2028 »
export const periodeTalLisible = (p) => `du 2 avril ${p} au 1er avril ${p + 1}`;

// Date d'effet de la hausse : le lendemain de la fin d'un bail à durée fixe ;
// pour un bail à durée indéterminée, le 1er du mois dans deux mois (l'avis se
// donne de un à deux mois avant la modification)
export function debutHausse(bail, maintenant = new Date()) {
  if (bail.dateFin) return new Date(new Date(bail.dateFin).getTime() + JOUR);
  const d = new Date(maintenant);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 1, 12));
}

// Taux de base d'une période : { taux, officiel } ou null s'il n'est pas connu
export function pourcentageBase(periode, inscrits = {}) {
  if (POURCENTAGES_BASE_TAL[periode] != null) return { taux: POURCENTAGES_BASE_TAL[periode], officiel: true };
  const t = Number(inscrits?.[periode]);
  return t > 0 ? { taux: t, officiel: false } : null;
}

// Part d'une hausse de charges (taxes, assurances) qui dépasse le pourcentage
// de base, par année. avant, apres : montants annuels de l'immeuble.
export function excedentHausse(avant, apres, taux) {
  const a = Number(avant);
  const b = Number(apres);
  if (!(a > 0) || !(b >= 0)) return 0;
  return Math.max(0, arrondi(b - a - (a * taux) / 100));
}

// Hausse proposée pour un logement.
// loyer : loyer actuel ; taux : pourcentage de base (%) ; part : part du
// logement dans les loyers de l'immeuble (0 à 1) ; taxes, assurances :
// { avant, apres } de l'immeuble ; travaux : [{ montant, aide, logementId }]
// (logementId vide : travaux de l'immeuble) ; logementId : ce logement.
// → { base, taxes, assurances, travaux, hausse, nouveauLoyer, pourcentage }
export function calculHausseTal({ loyer, taux, part, taxes = {}, assurances = {}, travaux = [], logementId }) {
  const base = arrondi((loyer * taux) / 100);
  const exTaxes = excedentHausse(taxes.avant, taxes.apres, taux);
  const exAssurances = excedentHausse(assurances.avant, assurances.apres, taux);
  const net = (t) => Math.max(0, (Number(t.montant) || 0) - (Number(t.aide) || 0));
  const travauxImmeuble = travaux.filter((t) => !t.logementId).reduce((s, t) => s + net(t), 0);
  const travauxLogement = travaux.filter((t) => t.logementId && t.logementId === logementId).reduce((s, t) => s + net(t), 0);
  const admissible = arrondi(travauxImmeuble * part + travauxLogement);
  const lignes = {
    base,
    taxes: arrondi((exTaxes * part) / 12),
    assurances: arrondi((exAssurances * part) / 12),
    travaux: arrondi((admissible * POURCENTAGE_IMMOBILISATIONS_TAL) / 100 / 12),
  };
  const hausse = arrondi(lignes.base + lignes.taxes + lignes.assurances + lignes.travaux);
  return {
    ...lignes, hausse, nouveauLoyer: arrondi(loyer + hausse), pourcentage: loyer > 0 ? Math.round((hausse / loyer) * 10000) / 100 : 0,
    detail: { exTaxes, exAssurances, travauxImmeuble: arrondi(travauxImmeuble), travauxLogement: arrondi(travauxLogement), admissible },
  };
}

// Loyers de l'immeuble qui servent à la part de chaque logement : le loyer
// du bail en cours, sinon le loyer demandé du logement vacant. Tous les
// logements et locaux comptent (commerciaux compris).
// → { total, parLogement: { [logementId]: loyer }, sansLoyer: [logement] }
export function loyersImmeuble(logements) {
  const parLogement = {};
  const sansLoyer = [];
  for (const l of logements) {
    const loyer = bailActuel(l)?.loyer ?? l.loyerVise;
    if (loyer > 0) parLogement[l.id] = loyer;
    else sansLoyer.push(l);
  }
  return { total: arrondi(Object.values(parLogement).reduce((s, x) => s + x, 0)), parLogement, sansLoyer };
}

// Hausses proposées pour les baux résidentiels en cours d'un immeuble.
// entrees : { taux: { [periode]: % }, taxes, assurances, travaux }
// → [{ bail, logement, debut, periode, taux, part, calcul | null }]
export function haussesImmeuble(immeuble, entrees, maintenant = new Date()) {
  const { total, parLogement } = loyersImmeuble(immeuble.logements);
  const out = [];
  for (const logement of immeuble.logements) {
    const bail = bailActuel(logement);
    if (!bail || logement.type !== "LOGEMENT") continue;
    const debut = debutHausse(bail, maintenant);
    const periode = periodeTal(debut);
    const taux = pourcentageBase(periode, entrees.taux);
    const part = total > 0 ? (parLogement[logement.id] || 0) / total : 0;
    out.push({
      bail, logement, debut, periode, taux, part,
      calcul: taux ? calculHausseTal({ loyer: bail.loyer, taux: taux.taux, part, taxes: entrees.taxes, assurances: entrees.assurances, travaux: entrees.travaux, logementId: logement.id }) : null,
    });
  }
  return out;
}

// ---------- Revenus de location pour l'impôt (T776 et TP-128) ----------
//
// État annuel des revenus et dépenses de location de chaque immeuble, sur
// les lignes du formulaire T776 de l'ARC (État des loyers de biens
// immeubles) ; Revenu Québec demande les mêmes renseignements sur un TP-128
// par immeuble. Méthode de comptabilité d'exercice : les loyers inscrits pour
// l'année (pas seulement ceux reçus), les dépenses à leur date, les
// réparations terminées dans l'année. Les dépenses d'immobilisation (travaux
// majeurs, achats durables) ne se déduisent pas : elles sont listées à part
// pour la déduction pour amortissement (DPA), à établir avec le comptable,
// comme la part personnelle et la part de chaque copropriétaire.

export const LIGNES_T776 = [
  { ligne: "8690", label: "Assurances", categories: ["ASSURANCE"] },
  { ligne: "8710", label: "Intérêts et frais bancaires", categories: ["INTERETS"] },
  { ligne: "8860", label: "Honoraires professionnels (frais juridiques et comptables)", categories: ["HONORAIRES"] },
  { ligne: "8871", label: "Frais de gestion et d'administration", categories: ["GESTION"], note: "Publicité (8521) et frais bancaires (8710) inscrits sous « Gestion » : à reclasser au besoin" },
  { ligne: "8960", label: "Entretien et réparations", categories: ["ENTRETIEN", "DENEIGEMENT"], reparations: true },
  { ligne: "9180", label: "Impôts fonciers (taxes municipales et scolaires)", categories: ["TAXES_MUNICIPALES", "TAXES_SCOLAIRES"] },
  { ligne: "9220", label: "Services publics (électricité, chauffage)", categories: ["ELECTRICITE", "CHAUFFAGE"], note: "Numéro de ligne à confirmer sur le formulaire de l'année" },
  { ligne: "9270", label: "Autres dépenses", categories: ["AUTRE"] },
];
const LIGNE_DE_CATEGORIE = Object.fromEntries(LIGNES_T776.flatMap((l) => (l.categories || []).map((c) => [c, l.ligne])));
export const ligneT776 = (categorie) => LIGNE_DE_CATEGORIE[categorie] || (categorie === "IMMOBILISATION" ? null : "9270");

// immeubles [{ id, nom, adresse, ville, unites }] ; pour l'année :
// charges [{ immeubleId, type, montant }], paiements [{ immeubleId, montant }],
// depenses [{ immeubleId, categorie, montant, date, description, payeA }],
// reparations [{ immeubleId, coutReel, immobilisation, numero, titre, date }]
// → { immeubles: [etat], total: etat } ; etat : { revenus: { 8141, 8230, total },
// percu, depenses: [{ ligne, label, note, montant }], totalDepenses, net, immobilisations: [...] }
export function etatRevenusLocation({ immeubles, charges = [], paiements = [], depenses = [], reparations = [] }) {
  const vide = () => ({ revenus: { 8141: 0, 8230: 0, total: 0 }, percu: 0, parLigne: {}, immobilisations: [] });
  const etats = Object.fromEntries(immeubles.map((i) => [i.id, { ...vide(), immeuble: i }]));
  for (const c of charges) {
    const e = etats[c.immeubleId];
    if (!e) continue;
    // Loyers, et crédits accordés (montants négatifs) : loyers bruts ; frais refacturés : autres revenus
    e.revenus[c.type === "LOYER" || c.montant < 0 ? 8141 : 8230] += c.montant;
  }
  for (const p of paiements) if (etats[p.immeubleId]) etats[p.immeubleId].percu += p.montant;
  for (const d of depenses) {
    const e = etats[d.immeubleId];
    if (!e) continue;
    const ligne = ligneT776(d.categorie);
    if (ligne) e.parLigne[ligne] = (e.parLigne[ligne] || 0) + d.montant;
    else e.immobilisations.push({ date: d.date, description: d.description || libelle(CATEGORIES_DEPENSE, d.categorie), payeA: d.payeA || null, montant: d.montant });
  }
  for (const r of reparations) {
    const e = etats[r.immeubleId];
    if (!e || !(r.coutReel > 0)) continue;
    if (r.immobilisation) e.immobilisations.push({ date: r.date, description: `${r.numero} — ${r.titre}`, payeA: r.entrepreneur || null, montant: r.coutReel });
    else e.parLigne["8960"] = (e.parLigne["8960"] || 0) + r.coutReel;
  }
  const finir = (e) => {
    const revenus = { 8141: arrondi(e.revenus[8141]), 8230: arrondi(e.revenus[8230]) };
    revenus.total = arrondi(revenus[8141] + revenus[8230]);
    const lignes = LIGNES_T776.map((l) => ({ ligne: l.ligne, label: l.label, note: l.note || null, montant: arrondi(e.parLigne[l.ligne] || 0) }));
    const totalDepenses = arrondi(lignes.reduce((s, l) => s + l.montant, 0));
    const immobilisations = [...e.immobilisations].sort((a, b) => new Date(a.date) - new Date(b.date)).map((x) => ({ ...x, montant: arrondi(x.montant) }));
    return {
      immeuble: e.immeuble, revenus, percu: arrondi(e.percu), depenses: lignes, totalDepenses, net: arrondi(revenus.total - totalDepenses),
      immobilisations, totalImmobilisations: arrondi(immobilisations.reduce((s, x) => s + x.montant, 0)),
    };
  };
  const liste = immeubles.map((i) => finir(etats[i.id]));
  // Total de tous les immeubles
  const t = vide();
  for (const e of liste) {
    t.revenus[8141] += e.revenus[8141];
    t.revenus[8230] += e.revenus[8230];
    t.percu += e.percu;
    for (const d of e.depenses) t.parLigne[d.ligne] = (t.parLigne[d.ligne] || 0) + d.montant;
    t.immobilisations.push(...e.immobilisations.map((x) => ({ ...x, description: `${e.immeuble.nom} : ${x.description}` })));
  }
  t.immeuble = { id: "TOUS", nom: "Tous les immeubles", unites: immeubles.reduce((s, i) => s + (i.unites || 0), 0) };
  return { immeubles: liste, total: finir(t) };
}

// ---------- Entretien préventif (lib/entretienImmo.js) ----------

// Ce qui revient le plus souvent dans un immeuble locatif au Québec :
// proposé à l'ajout d'un entretien, tout reste modifiable. dansLogements :
// se fait dans les logements (avis d'accès de 24 h aux locataires).
export const ENTRETIENS_SUGGERES_IMMO = [
  { titre: "Vérification des avertisseurs de fumée", type: "INSPECTION", categorie: "SECURITE", frequenceMois: 12, obligatoire: true, dansLogements: true, description: "Tester chaque avertisseur ; remplacer la pile ; un avertisseur de plus de 10 ans se remplace." },
  { titre: "Vérification des avertisseurs de monoxyde de carbone", type: "INSPECTION", categorie: "SECURITE", frequenceMois: 12, dansLogements: true, description: "Logements avec appareil à combustion (gaz, bois, mazout) ou garage attenant." },
  { titre: "Inspection des extincteurs portatifs", type: "INSPECTION", categorie: "SECURITE", frequenceMois: 12 },
  { titre: "Ramonage de la cheminée", type: "ENTRETIEN", categorie: "CHAUFFAGE", frequenceMois: 12, description: "Avant la saison de chauffage ; garder le certificat du ramoneur pour l'assureur." },
  { titre: "Entretien du système de chauffage (fournaise, thermopompe)", type: "ENTRETIEN", categorie: "CHAUFFAGE", frequenceMois: 12 },
  { titre: "Changement des filtres (fournaise, échangeur d'air)", type: "ENTRETIEN", categorie: "CHAUFFAGE", frequenceMois: 6, dansLogements: true },
  { titre: "Nettoyage des conduits de sécheuse", type: "ENTRETIEN", categorie: "SECURITE", frequenceMois: 12 },
  { titre: "Inspection des chauffe-eau", type: "INSPECTION", categorie: "PLOMBERIE", frequenceMois: 12, dansLogements: true, description: "Âge et fuites ; plusieurs assureurs exigent le remplacement après 10 à 15 ans." },
  { titre: "Vérification du clapet antiretour et des drains", type: "ENTRETIEN", categorie: "PLOMBERIE", frequenceMois: 12 },
  { titre: "Fermeture des robinets extérieurs avant l'hiver", type: "ENTRETIEN", categorie: "PLOMBERIE", frequenceMois: 12 },
  { titre: "Nettoyage des gouttières", type: "ENTRETIEN", categorie: "TOITURE", frequenceMois: 6 },
  { titre: "Inspection de la toiture", type: "INSPECTION", categorie: "TOITURE", frequenceMois: 12 },
  { titre: "Inspection des balcons, escaliers et garde-corps", type: "INSPECTION", categorie: "ENVELOPPE", frequenceMois: 12 },
  { titre: "Calfeutrage des fenêtres et des portes", type: "ENTRETIEN", categorie: "ENVELOPPE", frequenceMois: 24 },
  { titre: "Éclairage d'urgence et enseignes de sortie", type: "INSPECTION", categorie: "SECURITE", frequenceMois: 12 },
];

// Prochaine date après une intervention faite le « date »
export const prochaineApres = (date, frequenceMois) => ajouterMois(date, Math.max(1, Number(frequenceMois) || 12));

// Ce qui demande une action pour un entretien actif (liste « À faire », avis
// au propriétaire) : en retard, ou dans 14 jours ou moins → item ou null
export function aSurveillerEntretien(e, maintenant = new Date()) {
  if (!e.actif) return null;
  const etat = etatEcheance(e.prochaineDate, maintenant);
  if (etat.code === "PLUS_TARD" || etat.jours > 14) return null;
  const enRetard = etat.code === "RETARD";
  return {
    cle: `ent:${e.id}:${new Date(e.prochaineDate).toISOString().slice(0, 10)}`, code: enRetard ? "ENTRETIEN_RETARD" : "ENTRETIEN",
    niveau: enRetard ? (e.obligatoire ? 0 : 1) : 2, quoi: `${enRetard ? "Entretien en retard" : "Entretien à faire"} : ${e.titre}`,
    detail: `${enRetard ? `prévu le ${dateLisible(e.prochaineDate)}` : etat.label.toLowerCase()} · ${frequenceLisible(e.frequenceMois).toLowerCase()}${e.obligatoire ? " · exigé" : ""}${e.dansLogements ? " · avis d'accès aux locataires" : ""}`,
    href: "/immobilier/entretien", aviser: true,
  };
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
