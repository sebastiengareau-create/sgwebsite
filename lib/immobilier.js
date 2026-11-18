// Immobilier — module « Immobilier » (Administrateur → Modules), inactif tant
// que le super-administrateur ne l'active pas. Pour le propriétaire d'un ou
// de plusieurs immeubles locatifs :
//
//   1. Immeubles et logements : fiche de chaque immeuble (achat, évaluation,
//      hypothèque), ses logements et locaux, vacants ou loués.
//   2. Locataires et baux : colocataires, loyer, services inclus, échéance,
//      avis de modification selon les délais du TAL, renouvellement.
//   3. Loyers : loyers du mois générés pour chaque bail en cours (au prorata
//      d'un mois partiel), paiements, retards et relevé de chaque bail.
//   4. Dépenses et rendement : taxes, assurance, intérêts… par immeuble ;
//      revenus perçus moins dépenses et réparations.
//   5. Réparations : signalées par un locataire ou prévues, entrepreneur,
//      coûts, photos.
//   6. Documents : baux signés, avis, états des lieux, assurances (avec date
//      d'expiration), comptes de taxes…
//
// Volontairement autonome : rien n'est relié à la comptabilité, aux
// fournisseurs, aux clients ni aux autres modules — chaque client branchera
// ce qu'il lui faut. Accès « Immobilier » dans Administrateur → Rôles et
// accès. Listes et calculs sans base de données : lib/immobilierCalculs.js.
// Les outils génériques (validation, fichiers) sont ceux de la copropriété.
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { lireParametre } from "@/lib/parametres";
import { aAccesSection, obtenirSession } from "./auth";
import { prochainNumero, creerAvecNumero } from "./numerotation";
import { normaliser } from "./copropriete";
import {
  TYPES_IMMEUBLE, TYPES_LOGEMENT, STATUTS_BAIL, REPONSES_AVIS, TYPES_CHARGE, MODES_PAIEMENT, CATEGORIES_DEPENSE,
  CATEGORIES_REPARATION, PRIORITES, STATUTS_REPARATION, CATEGORIES_DOCUMENTS, SERVICES_BAIL, loyerDuMois, periodeLisible,
} from "./immobilierCalculs";

export { messageErreurPrisma, preparerFichierCopro as preparerFichier, reponseFichier } from "./copropriete";

export const CLE_MODULE = "module_immobilier";

export async function immobilierActif() {
  return (await lireParametre(CLE_MODULE)) === "actif";
}

export async function peutGererImmo(session) {
  return (await immobilierActif()) && (await aAccesSection(session, "immobilier"));
}

// Pour les routes d'API : la session si elle peut gérer l'immobilier, sinon null
export async function sessionImmo() {
  const session = await obtenirSession();
  return (await peutGererImmo(session)) ? session : null;
}

export const refus = () => NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
export const erreur = (texte, status = 400) => NextResponse.json({ erreur: texte }, { status });

// ---------- Validation des champs reçus (voir normaliser, lib/copropriete.js) ----------

const T = {
  texte: (max = 200) => ({ genre: "texte", max }),
  long: () => ({ genre: "texte", max: 8000 }),
  date: () => ({ genre: "date" }),
  montant: () => ({ genre: "montant" }),
  decimal: (min, max) => ({ genre: "decimal", min, max }),
  entier: (min, max) => ({ genre: "entier", min, max }),
  choix: (liste, { vide = false } = {}) => ({ genre: "choix", liste, vide }),
  id: () => ({ genre: "id" }),
};

const courrielInvalide = (c) => c && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

export const SPECS = {
  immeuble: {
    champs: {
      nom: T.texte(120), adresse: T.texte(300), ville: T.texte(120), codePostal: T.texte(10), type: T.choix(TYPES_IMMEUBLE),
      anneeConstruction: T.entier(1700, 2100), dateAchat: T.date(), prixAchat: T.montant(), evaluationMunicipale: T.montant(),
      valeurEstimee: T.montant(), soldeHypotheque: T.montant(), notes: T.long(),
    },
    noms: { prixAchat: "Prix d'achat", evaluationMunicipale: "Évaluation municipale", valeurEstimee: "Valeur estimée", soldeHypotheque: "Solde de l'hypothèque", anneeConstruction: "Année de construction" },
    requis: [["nom", "Indique le nom de l'immeuble (ou son adresse)."]],
  },
  logement: {
    champs: {
      immeubleId: T.id(), numero: T.texte(40), type: T.choix(TYPES_LOGEMENT), pieces: T.texte(20), etage: T.texte(20),
      superficie: T.decimal(0, 1e6), loyerVise: T.montant(), notes: T.long(),
    },
    noms: { superficie: "Superficie", loyerVise: "Loyer visé" },
    requis: [["immeubleId", "Choisis l'immeuble."], ["numero", "Indique le numéro du logement."]],
  },
  locataire: {
    champs: { nom: T.texte(160), courriel: T.texte(200), telephone: T.texte(40), telephone2: T.texte(40), contactUrgence: T.texte(300), notes: T.long() },
    requis: [["nom", "Indique le nom du locataire."]],
    verifier: (d) => (courrielInvalide(d.courriel) ? "Courriel invalide." : null),
  },
  bail: {
    champs: {
      logementId: T.id(), dateDebut: T.date(), dateFin: T.date(), loyer: T.montant(), jourPaiement: T.entier(1, 28), services: T.texte(500),
      statut: T.choix(STATUTS_BAIL), nouveauLoyer: T.montant(), avisEnvoyeLe: T.date(), reponseAvis: T.choix(REPONSES_AVIS, { vide: true }),
      terminaisonLe: T.date(), notes: T.long(),
    },
    noms: { dateDebut: "Début du bail", dateFin: "Fin du bail", loyer: "Loyer", jourPaiement: "Jour du paiement", nouveauLoyer: "Nouveau loyer", avisEnvoyeLe: "Date de l'avis", terminaisonLe: "Date de départ" },
    requis: [["logementId", "Choisis le logement."], ["dateDebut", "Indique le début du bail."], ["loyer", "Indique le loyer mensuel."]],
    apres: (d) => {
      if ("jourPaiement" in d && d.jourPaiement === null) d.jourPaiement = 1;
      if (d.services) d.services = d.services.split(",").map((s) => s.trim()).filter((s) => SERVICES_BAIL.some((x) => x.code === s)).join(",") || null;
    },
    verifier: (d) => (d.dateDebut && d.dateFin && d.dateFin < d.dateDebut ? "La fin du bail précède son début." : null),
  },
  charge: {
    champs: { bailId: T.id(), date: T.date(), type: T.choix(TYPES_CHARGE), description: T.texte(300), montant: T.decimal(-1e7, 1e7) },
    noms: { montant: "Montant" },
    requis: [["bailId", "Choisis le bail."], ["date", "Indique la date."], ["montant", "Indique le montant."]],
  },
  paiement: {
    champs: { bailId: T.id(), date: T.date(), montant: T.montant(), mode: T.choix(MODES_PAIEMENT, { vide: true }), reference: T.texte(80), note: T.texte(500) },
    noms: { montant: "Montant" },
    requis: [["bailId", "Choisis le bail."], ["date", "Indique la date."], ["montant", "Indique le montant."]],
    verifier: (d) => (d.montant === 0 ? "Le montant doit être plus grand que zéro." : null),
  },
  depense: {
    champs: { immeubleId: T.id(), date: T.date(), categorie: T.choix(CATEGORIES_DEPENSE), description: T.texte(300), montant: T.montant(), payeA: T.texte(160), reference: T.texte(80) },
    noms: { montant: "Montant" },
    requis: [["immeubleId", "Choisis l'immeuble."], ["date", "Indique la date."], ["categorie", "Choisis la catégorie."], ["montant", "Indique le montant."]],
  },
  reparation: {
    champs: {
      titre: T.texte(200), description: T.long(), categorie: T.choix(CATEGORIES_REPARATION, { vide: true }), priorite: T.choix(PRIORITES),
      statut: T.choix(STATUTS_REPARATION), immeubleId: T.id(), logementId: T.id(), locataireId: T.id(), signalePar: T.texte(160),
      entrepreneur: T.texte(160), telephoneEntrepreneur: T.texte(40), datePrevue: T.date(), dateFin: T.date(),
      coutEstime: T.montant(), coutReel: T.montant(), numeroFacture: T.texte(80), notes: T.long(),
    },
    noms: { coutEstime: "Coût estimé", coutReel: "Coût réel", datePrevue: "Date prévue", dateFin: "Date de fin" },
    requis: [["titre", "Décris la réparation en quelques mots."], ["immeubleId", "Choisis l'immeuble."]],
  },
  document: {
    champs: {
      titre: T.texte(200), categorie: T.choix(CATEGORIES_DOCUMENTS), date: T.date(), expireLe: T.date(), description: T.texte(1000),
      immeubleId: T.id(), logementId: T.id(), bailId: T.id(), locataireId: T.id(),
    },
    noms: { expireLe: "Date d'expiration" },
    requis: [["titre", "Indique le titre du document."], ["categorie", "Choisis la catégorie."]],
  },
};

// Normalise selon SPECS[nom] ; creation = vérifie aussi les champs requis
export function normaliserModele(nom, entree, { creation = false } = {}) {
  const s = SPECS[nom];
  const r = normaliser(s.champs, entree, s.noms);
  if (r.erreur) return r;
  for (const [champ, message] of s.requis || []) {
    const vide = r.data[champ] == null || r.data[champ] === "";
    if (creation ? vide : champ in r.data && vide) return { erreur: message };
  }
  s.apres?.(r.data);
  const probleme = s.verifier?.(r.data);
  return probleme ? { erreur: probleme } : r;
}

// ---------- Numérotation ----------

export const prochainNumeroReparation = () => prochainNumero(prisma.reparationImmo, "numero", "RP");

export function creerReparation(data) {
  return creerAvecNumero(prochainNumeroReparation, (numero) => prisma.reparationImmo.create({ data: { ...data, numero } }));
}

// ---------- Loyers ----------

// Génère le loyer du mois (« 2026-11 ») de chaque bail en cours qui couvre ce
// mois, au prorata s'il commence ou finit en cours de mois. Un bail qui a
// déjà son loyer de ce mois n'est pas facturé deux fois. → { creees, total }
export async function genererLoyers(periode, creePar) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode || "")) return { erreur: "Mois invalide." };
  const [a, m] = periode.split("-").map(Number);
  const debutMois = new Date(Date.UTC(a, m - 1, 1, 12));
  const finMois = new Date(Date.UTC(a, m, 0, 12));
  const baux = await prisma.bailImmo.findMany({
    where: { statut: "ACTIF", dateDebut: { lte: finMois }, OR: [{ dateFin: null }, { dateFin: { gte: debutMois } }] },
  });
  const mois = periodeLisible(periode);
  const data = [];
  for (const b of baux) {
    const montant = loyerDuMois(b, periode);
    if (montant <= 0) continue;
    const jour = Math.min(b.jourPaiement || 1, new Date(Date.UTC(a, m, 0)).getUTCDate());
    data.push({
      bailId: b.id, date: new Date(Date.UTC(a, m - 1, jour, 12)), periode, type: "LOYER",
      description: `Loyer — ${mois}${montant !== b.loyer ? " (au prorata)" : ""}`, montant, creePar,
    });
  }
  const { count } = await prisma.chargeImmo.createMany({ data, skipDuplicates: true });
  return { creees: count, baux: baux.length };
}

// Soldes de tous les baux : { [bailId]: solde }
export async function soldesDesBaux(where = {}) {
  const [charges, paiements] = await Promise.all([
    prisma.chargeImmo.groupBy({ by: ["bailId"], where, _sum: { montant: true } }),
    prisma.paiementImmo.groupBy({ by: ["bailId"], where, _sum: { montant: true } }),
  ]);
  const soldes = {};
  for (const c of charges) soldes[c.bailId] = (soldes[c.bailId] || 0) + (c._sum.montant || 0);
  for (const p of paiements) soldes[p.bailId] = (soldes[p.bailId] || 0) - (p._sum.montant || 0);
  for (const k of Object.keys(soldes)) soldes[k] = Math.round(soldes[k] * 100) / 100;
  return soldes;
}

// Locataires d'un bail reçus du formulaire : locataireIds (déjà inscrits) et,
// au besoin, nouveauLocataire { nom, telephone, courriel } créé ici.
// → { ids } ou { erreur }
export async function locatairesDuBail(body) {
  const ids = [...new Set((Array.isArray(body.locataireIds) ? body.locataireIds : []).filter((x) => typeof x === "string" && x))];
  if (ids.length > 0 && (await prisma.locataireImmo.count({ where: { id: { in: ids } } })) !== ids.length) return { erreur: "Locataire introuvable." };
  const nouveau = body.nouveauLocataire;
  if (nouveau && String(nouveau.nom || "").trim()) {
    const r = normaliserModele("locataire", nouveau, { creation: true });
    if (r.erreur) return r;
    const l = await prisma.locataireImmo.create({ data: r.data, select: { id: true } });
    ids.push(l.id);
  }
  return { ids };
}

// Revenus et dépenses d'une année par immeuble (voir rendement(),
// lib/immobilierCalculs.js) : loyers facturés et perçus, dépenses, coût réel
// des réparations terminées dans l'année
export async function donneesRendement(annee) {
  const du = new Date(Date.UTC(annee, 0, 1));
  const au = new Date(Date.UTC(annee + 1, 0, 1));
  const viaBail = { bail: { select: { logement: { select: { immeubleId: true } } } } };
  const [charges, paiements, depenses, reparations] = await Promise.all([
    prisma.chargeImmo.findMany({ where: { date: { gte: du, lt: au } }, select: { montant: true, ...viaBail } }),
    prisma.paiementImmo.findMany({ where: { date: { gte: du, lt: au } }, select: { montant: true, ...viaBail } }),
    prisma.depenseImmo.findMany({ where: { date: { gte: du, lt: au } }, select: { immeubleId: true, montant: true, categorie: true } }),
    prisma.reparationImmo.findMany({ where: { statut: "TERMINEE", coutReel: { not: null }, OR: [{ dateFin: { gte: du, lt: au } }, { dateFin: null, creeLe: { gte: du, lt: au } }] }, select: { immeubleId: true, coutReel: true } }),
  ]);
  const aplatir = (x) => ({ montant: x.montant, immeubleId: x.bail.logement.immeubleId });
  return { charges: charges.map(aplatir), paiements: paiements.map(aplatir), depenses, reparations };
}
