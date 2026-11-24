// Immobilier — module « Immobilier » (Administrateur → Modules), inactif tant
// que le super-administrateur ne l'active pas. Pour le propriétaire d'un ou
// de plusieurs immeubles locatifs :
//
//   1. Immeubles et logements : fiche de chaque immeuble (achat, évaluation,
//      hypothèque), ses logements et locaux, vacants ou loués.
//   2. Locataires et baux : colocataires, loyer, services inclus, échéance,
//      avis de modification selon les délais du TAL, renouvellement.
//   3. Loyers : loyers du mois générés pour chaque bail en cours (au prorata
//      d'un mois partiel), paiements, retards (à recevoir jusqu'à l'échéance,
//      en retard ensuite — comptesDesBaux) et relevé de chaque bail ;
//      inscription automatique et rappels : lib/immobilierAuto.js.
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
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { lireParametre } from "@/lib/parametres";
import { aAccesSection, obtenirSession } from "./auth";
import { prochainNumero, creerAvecNumero } from "./numerotation";
import { normaliser } from "./copropriete";
import {
  TYPES_IMMEUBLE, TYPES_LOGEMENT, STATUTS_BAIL, REPONSES_AVIS, TYPES_CHARGE, MODES_PAIEMENT, CATEGORIES_DEPENSE,
  CATEGORIES_REPARATION, PRIORITES, STATUTS_REPARATION, CATEGORIES_DOCUMENTS, SERVICES_BAIL, CHAUFFAGES, ANIMAUX, FUMEUR, loyerDuMois, periodeLisible, libelle, etatCompte,
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
      anneeConstruction: T.entier(1700, 2100), entrepreneur: T.texte(160), dateAchat: T.date(), prixAchat: T.montant(), evaluationMunicipale: T.montant(),
      valeurEstimee: T.montant(), soldeHypotheque: T.montant(), notes: T.long(),
    },
    noms: { prixAchat: "Prix d'achat", evaluationMunicipale: "Évaluation municipale", valeurEstimee: "Valeur estimée", soldeHypotheque: "Solde de l'hypothèque", anneeConstruction: "Année de construction" },
    requis: [["nom", "Indique le nom de l'immeuble (ou son adresse)."]],
  },
  logement: {
    champs: {
      immeubleId: T.id(), numero: T.texte(40), type: T.choix(TYPES_LOGEMENT), pieces: T.texte(20), etage: T.texte(20),
      superficie: T.decimal(0, 1e6), loyerVise: T.montant(), numeroLogementRq: T.texte(30), adresseCivique: T.texte(200), notes: T.long(),
    },
    noms: { superficie: "Superficie", loyerVise: "Loyer visé", numeroLogementRq: "Numéro de logement (relevé 31)" },
    requis: [["immeubleId", "Choisis l'immeuble."], ["numero", "Indique le numéro du logement."]],
  },
  locataire: {
    champs: { avisCourriel: { genre: "bool" }, nom: T.texte(160), courriel: T.texte(200), telephone: T.texte(40), telephone2: T.texte(40), contactUrgence: T.texte(300), notes: T.long() },
    requis: [["nom", "Indique le nom du locataire."]],
    verifier: (d) => (courrielInvalide(d.courriel) ? "Courriel invalide." : null),
  },
  bail: {
    champs: {
      logementId: T.id(), dateDebut: T.date(), dateFin: T.date(), loyer: T.montant(), jourPaiement: T.entier(1, 28), services: T.texte(500),
      statut: T.choix(STATUTS_BAIL), nouveauLoyer: T.montant(), avisEnvoyeLe: T.date(), reponseAvis: T.choix(REPONSES_AVIS, { vide: true }),
      terminaisonLe: T.date(), notes: T.long(),
      // Mentions du bail complet (sections B à G du formulaire du TAL)
      accessoires: T.texte(500), usageMixte: { genre: "bool" }, modePaiement: T.choix(MODES_PAIEMENT, { vide: true }), lieuPaiement: T.texte(300),
      chequesPostdates: { genre: "bool" }, premierPaiementLe: T.date(), chauffage: T.choix(CHAUFFAGES, { vide: true }), animaux: T.choix(ANIMAUX, { vide: true }),
      fumeur: T.choix(FUMEUR, { vide: true }), assuranceResponsabilite: { genre: "bool" }, reglementRemisLe: T.date(), travauxPromis: T.texte(2000),
      conditions: T.long(), immeubleNeuf: { genre: "bool" }, hausseMaximaleF: T.texte(300), loyerAncien: T.montant(), loyerAncienNote: T.texte(500), caution: T.texte(300),
    },
    noms: {
      dateDebut: "Début du bail", dateFin: "Fin du bail", loyer: "Loyer", jourPaiement: "Jour du paiement", nouveauLoyer: "Nouveau loyer", avisEnvoyeLe: "Date de l'avis", terminaisonLe: "Date de départ",
      modePaiement: "Mode de paiement", premierPaiementLe: "Premier paiement", chauffage: "Chauffage", animaux: "Animaux", fumeur: "Usage du tabac", reglementRemisLe: "Remise du règlement",
      loyerAncien: "Loyer le plus bas des 12 derniers mois",
    },
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
      reponse: T.long(),
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
      visibleLocataire: { genre: "bool" },
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

// Comptes des baux (where : filtre sur les charges et paiements, ex.
// { bail: { logementId } }) : { [bailId]: etatCompte() } — solde, montant en
// retard (échéance passée), à recevoir, jours de retard
export async function comptesDesBaux(where = {}, maintenant = new Date()) {
  const [charges, paiements] = await Promise.all([
    prisma.chargeImmo.findMany({ where, select: { bailId: true, date: true, montant: true } }),
    prisma.paiementImmo.groupBy({ by: ["bailId"], where, _sum: { montant: true } }),
  ]);
  const parBail = {};
  const de = (id) => (parBail[id] ||= { charges: [], paiements: [] });
  for (const c of charges) de(c.bailId).charges.push(c);
  for (const p of paiements) de(p.bailId).paiements.push({ montant: p._sum.montant || 0 });
  return Object.fromEntries(Object.entries(parBail).map(([id, x]) => [id, etatCompte(x, maintenant)]));
}

// Soldes seuls, tirés des comptes : { [bailId]: solde }
export const soldesDe = (comptes) => Object.fromEntries(Object.entries(comptes).map(([id, c]) => [id, c.solde]));

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

// ---------- Documents générés (lib/pdfImmobilier.js) ----------

const INCLURE_BAIL = {
  logement: { include: { immeuble: true } },
  locataires: { orderBy: { nom: "asc" } },
  charges: { orderBy: { date: "asc" } },
  paiements: { orderBy: { date: "asc" } },
};
export const bailComplet = (id) => prisma.bailImmo.findUnique({ where: { id }, include: INCLURE_BAIL });

const dateValide = (v) => /^\d{4}-\d{2}-\d{2}/.test(v || "");
const aMidi = (v) => new Date(`${String(v).slice(0, 10)}T12:00:00Z`);
const montant = (v) => Number(String(v ?? "").replace(",", ".").replace(/\s/g, ""));

// Marque des valeurs du calcul de hausse préparées par le serveur
// (lib/immobilierHausses.js) : une requête du navigateur ne peut pas la porter
export const CALCUL_INTERNE = Symbol("calcul de hausse du serveur");

// Vérifie les valeurs propres à chaque document → { valeurs } ou { erreur }
function valeursDocument(type, bail, v) {
  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  const r = { ...v, dateAvis: aMidi(dateValide(v.dateAvis) ? v.dateAvis : aujourdhui) };
  switch (type) {
    case "AVIS_MODIFICATION":
      if (bail.statut !== "ACTIF") return { erreur: "Ce bail n'est plus en cours." };
      if (!bail.dateFin) return { erreur: "Bail à durée indéterminée : l'avis de modification se rédige à la main pour l'instant." };
      r.nouveauLoyer = montant(v.nouveauLoyer ?? bail.nouveauLoyer);
      if (!(r.nouveauLoyer > 0)) return { erreur: "Indique le nouveau loyer proposé." };
      if (v.duree && !(Number(v.duree) >= 1 && Number(v.duree) <= 120)) return { erreur: "Durée invalide (1 à 120 mois)." };
      r.autresModifications = String(v.autresModifications || "").slice(0, 1000);
      break;
    case "AVIS_REPRISE":
      if (!String(v.beneficiaire || "").trim()) return { erreur: "Indique la personne qui habitera le logement." };
      if (!dateValide(v.dateReprise)) return { erreur: "Indique la date de la reprise." };
      r.dateReprise = aMidi(v.dateReprise);
      r.beneficiaire = String(v.beneficiaire).slice(0, 160);
      r.lien = String(v.lien || "").slice(0, 120);
      break;
    case "AVIS_ACCES":
      if (!dateValide(v.dateAcces)) return { erreur: "Indique la date de la visite." };
      r.dateAcces = aMidi(v.dateAcces);
      r.heure = String(v.heure || "").slice(0, 40);
      r.details = String(v.details || "").slice(0, 600);
      break;
    case "RAPPEL_RETARD":
    case "MISE_EN_DEMEURE":
      if (etatCompte(bail).enRetard <= 0.005) return { erreur: "Ce bail n'a aucun montant en retard (un loyer pas encore échu n'est pas en retard)." };
      r.delaiJours = Math.min(Math.max(Number(v.delaiJours) || 10, 1), 60);
      break;
    case "ETAT_LIEUX":
      r.moment = v.moment === "SORTIE" ? "SORTIE" : "ENTREE";
      r.dateVisite = dateValide(v.dateVisite) ? aMidi(v.dateVisite) : r.dateAvis;
      break;
    case "FICHE_BAIL":
      break;
    case "CALCUL_HAUSSE":
      if (!v[CALCUL_INTERNE] || !v.calcul) return { erreur: "Le calcul de la hausse se fait dans Immeuble → Hausses de loyer." };
      break;
    case "BAIL_LOGEMENT":
      if (bail.locataires.length === 0) return { erreur: "Inscris au moins un locataire au bail." };
      r.lieu = String(v.lieu || "").slice(0, 120);
      break;
    default:
      return { erreur: "Type de document inconnu." };
  }
  return { valeurs: r };
}

const TITRES_DOCUMENTS = {
  AVIS_MODIFICATION: (v) => `Avis de modification du bail — nouveau loyer de ${v.nouveauLoyer.toFixed(2).replace(".", ",")} $`,
  AVIS_REPRISE: () => "Avis de reprise du logement",
  AVIS_ACCES: (v) => `Avis d'accès au logement — ${v.dateAcces.toISOString().slice(0, 10)}`,
  RAPPEL_RETARD: () => "Rappel — loyer en retard",
  MISE_EN_DEMEURE: () => "Mise en demeure — loyer impayé",
  ETAT_LIEUX: (v) => `État des lieux — ${v.moment === "SORTIE" ? "sortie" : "entrée"}`,
  FICHE_BAIL: () => "Fiche de bail (pour remplir le formulaire du TAL)",
  CALCUL_HAUSSE: (v) => `Calcul de la hausse de loyer — nouveau loyer de ${v.calcul.nouveauLoyer.toFixed(2).replace(".", ",")} $`,
  BAIL_LOGEMENT: (v, bail) => `Bail de logement — ${bail.dateFin ? `${bail.dateDebut.toISOString().slice(0, 10)} au ${bail.dateFin.toISOString().slice(0, 10)}` : `depuis le ${bail.dateDebut.toISOString().slice(0, 10)}`}`,
};

// Instantané (JSON) des données qui ont produit un document → objets avec
// leurs dates, pour le reproduire à l'identique (lib/signatureImmo.js)
const DATE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
export const revivreInstantane = (x) => JSON.parse(JSON.stringify(x), (k, v) => (typeof v === "string" && DATE_ISO.test(v) ? new Date(v) : v));

// Génère le PDF et le range dans les documents du bail. L'avis de
// modification note aussi, au besoin, le nouveau loyer et la date d'envoi sur
// le bail. → { id } ou { erreur }
export async function genererDocumentBail(bailId, type, entree, creePar) {
  const { TYPES_DOCUMENTS_GENERES } = await import("./pdfImmobilier");
  const def = TYPES_DOCUMENTS_GENERES[type];
  if (!def) return { erreur: "Type de document inconnu." };
  const bail = await bailComplet(bailId);
  if (!bail) return { erreur: "Bail introuvable." };
  const r = valeursDocument(type, bail, entree || {});
  if (r.erreur) return r;
  const { obtenirInfosEntreprise } = await import("./config");
  const entreprise = await obtenirInfosEntreprise();
  const donnees = await def.fonction(bail, entreprise, r.valeurs);
  const titre = TITRES_DOCUMENTS[type](r.valeurs, bail);
  // Document à faire signer : on garde de quoi le reproduire avec les
  // signatures (sans le compte, inutile à ces documents)
  const instantane = def.signature ? JSON.parse(JSON.stringify({
    bail: { ...bail, charges: [], paiements: [], locataires: bail.locataires.map(({ id, nom, courriel, telephone }) => ({ id, nom, courriel, telephone })) },
    entreprise, valeurs: r.valeurs,
  })) : undefined;
  const nom = `${titre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}.pdf`;
  const doc = await prisma.documentImmo.create({
    data: {
      titre, categorie: def.categorie, date: r.valeurs.dateAvis, description: `Généré par l'appli — ${def.label.toLowerCase()}.`,
      immeubleId: bail.logement.immeubleId, logementId: bail.logementId, bailId: bail.id,
      locataireId: bail.locataires.length === 1 ? bail.locataires[0].id : null,
      nom, typeMime: "application/pdf", taille: donnees.length, donnees, creePar, visibleLocataire: Boolean(def.locataire),
      genre: type, instantane,
    },
    select: { id: true },
  });
  if (type === "AVIS_MODIFICATION" && entree.marquerEnvoye !== false) {
    await prisma.bailImmo.update({ where: { id: bail.id }, data: { nouveauLoyer: r.valeurs.nouveauLoyer, avisEnvoyeLe: r.valeurs.dateAvis, reponseAvis: null } });
  }
  return { id: doc.id };
}


// ---------- Portail des locataires ----------
//
// /portail-locataire/<jeton> : espace sécurisé par un lien secret propre à
// chaque locataire — son logement et son bail, son compte et ses reçus, les
// documents qui lui sont permis, ses demandes de réparation et leur suivi,
// et sa réponse à un avis de modification du bail.

export function nouveauJeton() {
  return crypto.randomBytes(24).toString("base64url");
}

export function lienPortailLocataire(jeton) {
  return `${(process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "")}/portail-locataire/${jeton}`;
}

// Locataire d'un lien de portail, si le module est actif → ou null
export async function locataireParJeton(jeton) {
  if (!jeton || typeof jeton !== "string" || jeton.length < 20) return null;
  if (!(await immobilierActif())) return null;
  return prisma.locataireImmo.findUnique({ where: { jetonPortail: jeton } });
}

// Baux de ce locataire (en cours d'abord) avec ce qu'il faut pour les filtres
export function bauxDuLocataire(locataireId) {
  return prisma.bailImmo.findMany({
    where: { locataires: { some: { id: locataireId } } },
    select: { id: true, statut: true, logementId: true, logement: { select: { immeubleId: true } } },
  });
}

// Filtre Prisma des documents qu'un locataire peut voir : marqués visibles,
// et rattachés à lui, à un de ses baux, à son logement actuel, ou à tout son
// immeuble (règlement de l'immeuble, avis à tous)
export function filtreDocumentsLocataire(locataireId, baux) {
  const actifs = baux.filter((b) => b.statut === "ACTIF");
  return {
    visibleLocataire: true,
    OR: [
      { locataireId },
      { bailId: { in: baux.map((b) => b.id) } },
      { logementId: { in: actifs.map((b) => b.logementId) }, bailId: null, locataireId: null },
      { immeubleId: { in: actifs.map((b) => b.logement.immeubleId) }, logementId: null, bailId: null, locataireId: null },
    ],
  };
}

// Réparations qu'il voit : celles qu'il a signalées, et celles de son logement actuel
export function filtreReparationsLocataire(locataireId, baux) {
  return { OR: [{ locataireId }, { logementId: { in: baux.filter((b) => b.statut === "ACTIF").map((b) => b.logementId) } }] };
}

async function envoyerCourrielImmo({ a, sujet, lignes }) {
  if (!process.env.RESEND_API_KEY) throw new Error("L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant).");
  const { Resend } = await import("resend");
  const { obtenirInfosEntreprise } = await import("./config");
  const { nomEntreprise } = await obtenirInfosEntreprise();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const de = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const { error } = await resend.emails.send({ from: `${nomEntreprise} <${de}>`, to: a, subject: sujet, text: lignes.join("\n") });
  if (error) throw new Error(error.message || JSON.stringify(error));
}

// Lien du portail envoyé au locataire. Lance une erreur si l'envoi échoue.
export async function envoyerLienPortailLocataire(locataire) {
  const { obtenirInfosEntreprise } = await import("./config");
  const { nomEntreprise, telephone } = await obtenirInfosEntreprise();
  await envoyerCourrielImmo({
    a: locataire.courriel,
    sujet: `Votre espace locataire — ${nomEntreprise}`,
    lignes: [
      `Bonjour ${locataire.nom},`,
      "",
      "Voici le lien de votre espace locataire. Vous y trouverez votre bail et votre compte de loyer (avec vos reçus), les documents qui vous concernent, et vous pourrez y faire une demande de réparation et en suivre la progression.",
      "",
      lienPortailLocataire(locataire.jetonPortail),
      "",
      "Ce lien vous est personnel : ne le partagez pas.",
      ...(telephone ? ["", `Pour toute question : ${telephone}`] : []),
      "",
      nomEntreprise,
    ],
  });
}

// Avis de progression d'une réparation au locataire qui l'a demandée (s'il a
// un courriel et accepte les avis). Ne lance jamais d'erreur. → true si envoyé
export async function aviserLocataireReparation(reparationId, message) {
  try {
    if (!process.env.RESEND_API_KEY) return false;
    const r = await prisma.reparationImmo.findUnique({ where: { id: reparationId }, include: { locataire: true } });
    const l = r?.locataire;
    if (!l?.courriel || !l.avisCourriel) return false;
    const { obtenirInfosEntreprise } = await import("./config");
    const { nomEntreprise, telephone } = await obtenirInfosEntreprise();
    await envoyerCourrielImmo({
      a: l.courriel,
      sujet: `Votre demande ${r.numero} — ${libelle(STATUTS_REPARATION, r.statut)}`,
      lignes: [
        `Bonjour ${l.nom},`, "", `Du nouveau pour votre demande ${r.numero} : « ${r.titre} ».`, "", message, "",
        `État : ${libelle(STATUTS_REPARATION, r.statut)}`,
        ...(l.jetonPortail ? ["", "Suivre la demande dans votre espace locataire :", lienPortailLocataire(l.jetonPortail)] : []),
        ...(telephone ? ["", `Pour toute question : ${telephone}`] : []),
        "", nomEntreprise,
      ],
    });
    return true;
  } catch (e) {
    console.error("Avis de réparation non envoyé :", e.message || e);
    return false;
  }
}
