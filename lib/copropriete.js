// Copropriété — module « Copropriété » (Administrateur → Modules), inactif
// tant que le super-administrateur ne l'active pas. Gestion d'un syndicat de
// copropriété :
//
//   1. Unités et copropriétaires : fiche de chaque unité (quote-part,
//      stationnements, rangements, occupants et locataires), historique des
//      propriétaires (ProprieteCopro), fiche de chaque copropriétaire.
//   2. Charges communes : budget annuel réparti selon les quotes-parts,
//      cotisations générées chaque mois, paiements et solde de chaque unité.
//   3. Entretien : demandes de réparation et signalements (avec photos),
//      bons de travail confiés aux fournisseurs, suivi, coûts, entretien
//      préventif et calendrier des inspections.
//   4. Documents : procès-verbaux, règlements, états financiers… classés et
//      partagés aux copropriétaires dans leur portail.
//
// Le portail (/portail-copro/<jeton>) est un espace sécurisé par un lien
// secret propre à chaque copropriétaire, à mettre en lien sur le site web
// ou à envoyer par courriel : ses unités et son solde, les documents qui lui
// sont permis, ses demandes et leur progression, et un formulaire pour en
// faire une nouvelle.
//
// Accès « Copropriété » dans Administrateur → Rôles et accès. Listes et
// calculs sans base de données : lib/coproprieteCalculs.js.
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { aAccesSection, obtenirSession } from "./auth";
import { prochainNumero, creerAvecNumero } from "./numerotation";
import { obtenirInfosEntreprise } from "./config";
import {
  TYPES_UNITE, TYPES_OCCUPANT, TYPES_ESPACE, MODES_ESPACE, TYPES_CHARGE, MODES_PAIEMENT, CATEGORIES_TRAVAUX,
  PRIORITES, STATUTS_DEMANDE, STATUTS_TRAVAIL, TYPES_DEMANDE, TYPES_ENTRETIEN, CATEGORIES_DOCUMENTS, VISIBILITES,
  budgetPourPeriode, repartitionBudget, libelle, periodeLisible,
} from "./coproprieteCalculs";

export const CLE_MODULE = "module_copropriete";

export async function coproprieteActive() {
  const p = await prisma.parametre.findUnique({ where: { cle: CLE_MODULE } });
  return p?.valeur === "actif";
}

export async function peutGererCopro(session) {
  return (await coproprieteActive()) && (await aAccesSection(session, "copropriete"));
}

// Pour les routes d'API : la session si elle peut gérer la copropriété, sinon null
export async function sessionCopro() {
  const session = await obtenirSession();
  return (await peutGererCopro(session)) ? session : null;
}

export const refus = () => NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
export const erreur = (texte, status = 400) => NextResponse.json({ erreur: texte }, { status });

// ---------- Validation des champs reçus ----------
// Chaque modèle décrit ses champs modifiables (SPECS) ; normaliser() →
// { data } prêt pour Prisma, ou { erreur }. Seuls les champs présents sont
// repris (modification partielle).

const nombre = (v) => {
  const t = String(v ?? "").replace(",", ".").replace(/\s/g, "").replace(/\$$/, "");
  return t === "" ? null : Number(t);
};
const arrondi = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

const T = {
  texte: (max = 200) => ({ genre: "texte", max }),
  long: () => ({ genre: "texte", max: 8000 }),
  date: () => ({ genre: "date" }),
  montant: () => ({ genre: "montant" }),
  decimal: (min, max) => ({ genre: "decimal", min, max }),
  entier: (min, max) => ({ genre: "entier", min, max }),
  bool: () => ({ genre: "bool" }),
  choix: (liste, { vide = false } = {}) => ({ genre: "choix", liste, vide }),
  id: () => ({ genre: "id" }),
};

export function normaliser(specs, entree, noms = {}) {
  const data = {};
  for (const [champ, spec] of Object.entries(specs)) {
    const v = entree[champ];
    if (v === undefined) continue;
    const nom = noms[champ] || champ;
    switch (spec.genre) {
      case "texte":
        data[champ] = String(v ?? "").trim().slice(0, spec.max) || null;
        break;
      case "date": {
        if (!v) { data[champ] = null; break; }
        if (!/^\d{4}-\d{2}-\d{2}/.test(v)) return { erreur: `${nom} : date invalide.` };
        // midi UTC : la même journée au Québec, quel que soit le fuseau
        data[champ] = new Date(`${String(v).slice(0, 10)}T12:00:00Z`);
        break;
      }
      case "montant": {
        const n = nombre(v);
        if (n !== null && (!Number.isFinite(n) || n < 0 || n > 1e9)) return { erreur: `${nom} : montant invalide.` };
        data[champ] = n === null ? null : arrondi(n);
        break;
      }
      case "decimal":
      case "entier": {
        const n = nombre(v);
        if (n !== null && (!Number.isFinite(n) || (spec.genre === "entier" && !Number.isInteger(n)) || (spec.min != null && n < spec.min) || (spec.max != null && n > spec.max))) {
          return { erreur: `${nom} : valeur invalide${spec.min != null && spec.max != null ? ` (${spec.min} à ${spec.max})` : ""}.` };
        }
        data[champ] = n === null ? null : spec.genre === "entier" ? n : arrondi(n, 4);
        break;
      }
      case "bool":
        data[champ] = Boolean(v);
        break;
      case "choix":
        if (!v && spec.vide) { data[champ] = null; break; }
        if (!spec.liste.some((x) => x.code === v)) return { erreur: `${nom} : choix invalide.` };
        data[champ] = v;
        break;
      case "id":
        data[champ] = v ? String(v) : null;
        break;
    }
  }
  return { data };
}

export const SPECS = {
  batiment: {
    champs: { nom: T.texte(120), adresse: T.texte(300), anneeConstruction: T.entier(1800, 2100), nbEtages: T.entier(0, 200), notes: T.long() },
    requis: [["nom", "Indique le nom du bâtiment."]],
  },
  unite: {
    champs: {
      numero: T.texte(40), batimentId: T.id(), type: T.choix(TYPES_UNITE), numeroLot: T.texte(60), etage: T.texte(20),
      superficie: T.decimal(0, 1e6), quotePart: T.decimal(0, 100), notes: T.long(),
    },
    noms: { quotePart: "Quote-part", superficie: "Superficie" },
    requis: [["numero", "Indique le numéro de l'unité."]],
    // quotePart est obligatoire en base : vide → 0
    apres: (d) => { if (d.quotePart === null) d.quotePart = 0; },
  },
  coproprietaire: {
    champs: { nom: T.texte(160), courriel: T.texte(200), telephone: T.texte(40), telephone2: T.texte(40), adressePostale: T.texte(300), notes: T.long(), avisCourriel: T.bool() },
    requis: [["nom", "Indique le nom du copropriétaire."]],
    verifier: (d) => (d.courriel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.courriel) ? "Courriel invalide." : null),
  },
  propriete: {
    champs: { uniteId: T.id(), coproprietaireId: T.id(), dateDebut: T.date(), dateFin: T.date(), partDetenue: T.decimal(0.01, 100), notes: T.texte(500) },
    noms: { partDetenue: "Part détenue", dateDebut: "Date d'acquisition", dateFin: "Date de vente" },
    requis: [["uniteId", "Choisis l'unité."], ["coproprietaireId", "Choisis le copropriétaire."]],
    apres: (d) => { if (d.partDetenue === null) d.partDetenue = 100; },
    verifier: (d) => (d.dateDebut && d.dateFin && d.dateFin < d.dateDebut ? "La date de vente précède la date d'acquisition." : null),
  },
  occupant: {
    champs: { uniteId: T.id(), type: T.choix(TYPES_OCCUPANT), nom: T.texte(160), courriel: T.texte(200), telephone: T.texte(40), dateDebut: T.date(), dateFin: T.date(), notes: T.texte(1000) },
    requis: [["uniteId", "Choisis l'unité."], ["nom", "Indique le nom."]],
  },
  espace: {
    champs: { type: T.choix(TYPES_ESPACE), numero: T.texte(40), batimentId: T.id(), emplacement: T.texte(160), uniteId: T.id(), mode: T.choix(MODES_ESPACE), fraisMensuel: T.montant(), notes: T.texte(1000) },
    noms: { fraisMensuel: "Frais mensuels" },
    requis: [["type", "Choisis le type."], ["numero", "Indique le numéro."]],
    apres: (d) => { if (d.fraisMensuel === null) d.fraisMensuel = 0; },
  },
  budget: {
    champs: { annee: T.entier(1990, 2100), moisDebut: T.entier(1, 12), chargesCourantes: T.montant(), fondsPrevoyance: T.montant(), fondsAutoAssurance: T.montant(), adopteLe: T.date(), notes: T.long() },
    noms: { annee: "Année", chargesCourantes: "Charges courantes", fondsPrevoyance: "Fonds de prévoyance", fondsAutoAssurance: "Fonds d'autoassurance" },
    requis: [["annee", "Indique l'année de l'exercice."]],
    apres: (d) => { for (const c of ["chargesCourantes", "fondsPrevoyance", "fondsAutoAssurance"]) if (d[c] === null) d[c] = 0; if (d.moisDebut === null) d.moisDebut = 1; },
  },
  charge: {
    champs: { uniteId: T.id(), date: T.date(), type: T.choix(TYPES_CHARGE), description: T.texte(300), montant: T.decimal(-1e7, 1e7) },
    noms: { montant: "Montant" },
    requis: [["uniteId", "Choisis l'unité."], ["date", "Indique la date."], ["montant", "Indique le montant."]],
  },
  paiement: {
    champs: { uniteId: T.id(), date: T.date(), montant: T.montant(), mode: T.choix(MODES_PAIEMENT, { vide: true }), reference: T.texte(80), note: T.texte(500) },
    noms: { montant: "Montant" },
    requis: [["uniteId", "Choisis l'unité."], ["date", "Indique la date."], ["montant", "Indique le montant."]],
    verifier: (d) => (d.montant === 0 ? "Le montant doit être plus grand que zéro." : null),
  },
  demande: {
    champs: {
      type: T.choix(TYPES_DEMANDE), titre: T.texte(200), description: T.long(), categorie: T.choix(CATEGORIES_TRAVAUX, { vide: true }),
      priorite: T.choix(PRIORITES), statut: T.choix(STATUTS_DEMANDE), batimentId: T.id(), uniteId: T.id(), emplacement: T.texte(160),
      coproprietaireId: T.id(), signalePar: T.texte(160), reponse: T.long(),
    },
    requis: [["titre", "Décris le problème en quelques mots."]],
  },
  travail: {
    champs: {
      titre: T.texte(200), description: T.long(), categorie: T.choix(CATEGORIES_TRAVAUX, { vide: true }), priorite: T.choix(PRIORITES),
      statut: T.choix(STATUTS_TRAVAIL), demandeId: T.id(), entretienId: T.id(), batimentId: T.id(), uniteId: T.id(), emplacement: T.texte(160),
      fournisseurId: T.id(), datePrevue: T.date(), dateFin: T.date(), coutEstime: T.montant(), coutReel: T.montant(),
      numeroFacture: T.texte(80), garantieFin: T.date(), notes: T.long(),
    },
    noms: { coutEstime: "Coût estimé", coutReel: "Coût réel", datePrevue: "Date prévue", dateFin: "Date de fin", garantieFin: "Fin de garantie" },
    requis: [["titre", "Indique les travaux à faire."]],
  },
  entretien: {
    champs: {
      titre: T.texte(200), type: T.choix(TYPES_ENTRETIEN), categorie: T.choix(CATEGORIES_TRAVAUX, { vide: true }), description: T.long(),
      batimentId: T.id(), emplacement: T.texte(160), frequenceMois: T.entier(1, 240), prochaineDate: T.date(), derniereDate: T.date(),
      fournisseurId: T.id(), coutEstime: T.montant(), obligatoire: T.bool(), actif: T.bool(), notes: T.long(),
    },
    noms: { frequenceMois: "Fréquence (mois)", prochaineDate: "Prochaine date", coutEstime: "Coût estimé" },
    requis: [["titre", "Indique l'entretien."], ["prochaineDate", "Indique la prochaine date."], ["frequenceMois", "Indique la fréquence."]],
  },
  document: {
    champs: { titre: T.texte(200), categorie: T.choix(CATEGORIES_DOCUMENTS), date: T.date(), description: T.texte(1000), visibilite: T.choix(VISIBILITES), uniteId: T.id(), batimentId: T.id() },
    requis: [["titre", "Indique le titre du document."], ["categorie", "Choisis la catégorie."]],
    verifier: (d) => (d.visibilite === "UNITE" && !d.uniteId ? "Choisis l'unité à qui ce document est réservé." : null),
  },
};

// Normalise selon SPECS[nom] ; creation = vérifie aussi les champs requis
export function normaliserModele(nom, entree, { creation = false } = {}) {
  const s = SPECS[nom];
  const r = normaliser(s.champs, entree, s.noms);
  if (r.erreur) return r;
  if (creation) {
    for (const [champ, message] of s.requis || []) if (r.data[champ] == null || r.data[champ] === "") return { erreur: message };
  } else {
    // un champ requis ne peut pas être vidé
    for (const [champ, message] of s.requis || []) if (champ in r.data && (r.data[champ] == null || r.data[champ] === "")) return { erreur: message };
  }
  s.apres?.(r.data);
  const probleme = s.verifier?.(r.data);
  return probleme ? { erreur: probleme } : r;
}

// Erreur Prisma lisible (doublon d'un champ unique)
export function messageErreurPrisma(e, doublon = "Ce numéro existe déjà.") {
  if (e?.code === "P2002") return doublon;
  if (e?.code === "P2003") return "Élément relié introuvable.";
  if (e?.code === "P2025") return "Introuvable.";
  return null;
}

// ---------- Numérotation ----------

export const prochainNumeroDemande = () => prochainNumero(prisma.demandeCopro, "numero", "DR");
export const prochainNumeroTravail = () => prochainNumero(prisma.travailCopro, "numero", "TR");

export function creerDemande(data) {
  return creerAvecNumero(prochainNumeroDemande, (numero) => prisma.demandeCopro.create({ data: { ...data, numero } }));
}
export function creerTravail(data) {
  return creerAvecNumero(prochainNumeroTravail, (numero) => prisma.travailCopro.create({ data: { ...data, numero } }));
}

// ---------- Fichiers (documents, photos, pièces jointes) ----------

const TAILLE_MAX = 20 * 1024 * 1024;
const TYPES_MIME = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  heic: "image/heic", heif: "image/heif", gif: "image/gif",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", mp4: "video/mp4", mov: "video/quicktime",
};
const IMAGES_REDUCTIBLES = ["jpg", "jpeg", "png", "webp"];

// Fichier reçu (FormData) → { nom, typeMime, taille, donnees } ou { erreur }.
// Photos de téléphone réduites (1600 px, JPEG) : 10 fois plus légères.
export async function preparerFichierCopro(fichier) {
  if (!fichier || typeof fichier === "string") return { erreur: "Aucun fichier reçu." };
  const nom = String(fichier.name || "fichier").trim().slice(0, 200) || "fichier";
  const ext = (/\.([a-z0-9]+)$/i.exec(nom)?.[1] || "").toLowerCase();
  if (!TYPES_MIME[ext]) return { erreur: `Type de fichier non accepté (${nom}).` };
  let donnees = Buffer.from(await fichier.arrayBuffer());
  if (donnees.length === 0) return { erreur: "Fichier vide." };
  if (donnees.length > TAILLE_MAX) return { erreur: `Fichier trop volumineux (20 Mo maximum) : ${nom}.` };
  if (IMAGES_REDUCTIBLES.includes(ext)) {
    try {
      const sharp = (await import("sharp")).default;
      const reduite = await sharp(donnees).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      if (reduite.length < donnees.length) {
        return { nom: nom.replace(/\.[a-z0-9]+$/i, ".jpg"), typeMime: "image/jpeg", taille: reduite.length, donnees: reduite };
      }
    } catch {
      // image illisible : gardée telle quelle
    }
  }
  return { nom, typeMime: TYPES_MIME[ext], taille: donnees.length, donnees };
}

// Réponse HTTP qui ouvre (images, PDF) ou télécharge un fichier enregistré
export function reponseFichier(fichier, request) {
  const telecharger = new URL(request.url).searchParams.has("telecharger");
  const enLigne = !telecharger && (fichier.typeMime.startsWith("image/") || fichier.typeMime === "application/pdf");
  const nomAscii = fichier.nom.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "fichier";
  return new Response(fichier.donnees, {
    headers: {
      "Content-Type": fichier.typeMime,
      "Content-Length": String(fichier.taille),
      "Content-Disposition": `${enLigne ? "inline" : "attachment"}; filename="${nomAscii}"; filename*=UTF-8''${encodeURIComponent(fichier.nom)}`,
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ---------- Charges communes ----------

// Génère les cotisations du mois (« 2026-11 ») de chaque unité selon le
// budget de l'exercice et sa quote-part, plus les frais mensuels des
// stationnements et rangements attribués. Une unité qui a déjà sa
// cotisation de ce mois n'est pas facturée deux fois.
// → { creees, budget } ou { erreur }
export async function genererCotisations(periode, creePar) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periode || "")) return { erreur: "Mois invalide." };
  const budgets = await prisma.budgetCopro.findMany();
  const budget = budgetPourPeriode(budgets, periode);
  if (!budget) return { erreur: `Aucun budget adopté ne couvre ${periodeLisible(periode)}. Ajoute d'abord le budget de l'exercice.` };
  const unites = await prisma.uniteCopro.findMany({ select: { id: true, numero: true, quotePart: true } });
  const { lignes } = repartitionBudget(budget, unites);
  const espaces = await prisma.espaceCopro.findMany({ where: { uniteId: { not: null }, fraisMensuel: { gt: 0 } } });
  const [a, m] = periode.split("-").map(Number);
  const date = new Date(Date.UTC(a, m - 1, 1, 12));
  const mois = periodeLisible(periode);

  const data = lignes
    .filter((l) => l.mensuel > 0)
    .map((l) => ({ uniteId: l.uniteId, date, periode, type: "COTISATION", description: `Charges communes — ${mois}`, montant: l.mensuel, creePar }));
  const parUnite = {};
  for (const e of espaces) (parUnite[e.uniteId] ||= []).push(e);
  for (const [uniteId, liste] of Object.entries(parUnite)) {
    const montant = arrondi(liste.reduce((s, e) => s + e.fraisMensuel, 0));
    const noms = liste.map((e) => `${libelle(TYPES_ESPACE, e.type).split(" /")[0]} ${e.numero}`).join(", ");
    data.push({ uniteId, date, periode, type: "ESPACE", description: `${noms} — ${mois}`, montant, creePar });
  }
  const { count } = await prisma.chargeCopro.createMany({ data, skipDuplicates: true });
  return { creees: count, budget };
}

// ---------- Portail des copropriétaires ----------

export function nouveauJeton() {
  return crypto.randomBytes(24).toString("base64url");
}

function adressePublique() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function lienPortail(jeton) {
  return `${adressePublique()}/portail-copro/${jeton}`;
}

// Copropriétaire d'un lien de portail, si le module est actif → ou null
export async function coproprietaireParJeton(jeton) {
  if (!jeton || typeof jeton !== "string" || jeton.length < 20) return null;
  if (!(await coproprieteActive())) return null;
  return prisma.coproprietaireCopro.findUnique({ where: { jetonPortail: jeton } });
}

// Unités dont il est propriétaire en ce moment
export async function unitesDuCoproprietaire(coproprietaireId) {
  const proprietes = await prisma.proprieteCopro.findMany({ where: { coproprietaireId, dateFin: null }, select: { uniteId: true } });
  return [...new Set(proprietes.map((p) => p.uniteId))];
}

// Filtre Prisma des documents qu'un copropriétaire peut voir
export function filtreDocumentsVisibles(uniteIds) {
  return { OR: [{ visibilite: "COPROPRIETAIRES" }, { visibilite: "UNITE", uniteId: { in: uniteIds } }] };
}

// ---------- Courriels ----------

async function envoyerCourriel({ a, sujet, lignes }) {
  if (!process.env.RESEND_API_KEY) throw new Error("L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant).");
  const { Resend } = await import("resend");
  const { nomEntreprise } = await obtenirInfosEntreprise();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const adresseEnvoi = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const { error } = await resend.emails.send({ from: `${nomEntreprise} <${adresseEnvoi}>`, to: a, subject: sujet, text: lignes.join("\n") });
  if (error) throw new Error(error.message || JSON.stringify(error));
}

// Lien du portail envoyé au copropriétaire. Lance une erreur si l'envoi échoue.
export async function envoyerLienPortail(coproprietaire) {
  const { nomEntreprise, telephone } = await obtenirInfosEntreprise();
  await envoyerCourriel({
    a: coproprietaire.courriel,
    sujet: `Votre espace copropriétaire — ${nomEntreprise}`,
    lignes: [
      `Bonjour ${coproprietaire.nom},`,
      "",
      "Voici le lien de votre espace copropriétaire. Vous y trouverez les documents de la copropriété (procès-verbaux, règlements, états financiers…), le compte de votre unité, et vous pourrez y faire une demande de réparation et en suivre la progression.",
      "",
      lienPortail(coproprietaire.jetonPortail),
      "",
      "Ce lien vous est personnel : ne le partagez pas.",
      ...(telephone ? ["", `Pour toute question : ${telephone}`] : []),
      "",
      nomEntreprise,
    ],
  });
}

// Avis de progression au copropriétaire qui a fait la demande (s'il a un
// courriel et n'a pas refusé les avis). Ne lance jamais d'erreur : un avis
// raté ne doit rien bloquer. → true si envoyé
export async function aviserDemandeur(demandeId, message) {
  try {
    if (!process.env.RESEND_API_KEY) return false;
    const demande = await prisma.demandeCopro.findUnique({ where: { id: demandeId }, include: { coproprietaire: true } });
    const c = demande?.coproprietaire;
    if (!c?.courriel || !c.avisCourriel) return false;
    const { nomEntreprise, telephone } = await obtenirInfosEntreprise();
    await envoyerCourriel({
      a: c.courriel,
      sujet: `Votre demande ${demande.numero} — ${libelle(STATUTS_DEMANDE, demande.statut)}`,
      lignes: [
        `Bonjour ${c.nom},`,
        "",
        `Du nouveau pour votre demande ${demande.numero} : « ${demande.titre} ».`,
        "",
        message,
        "",
        `État : ${libelle(STATUTS_DEMANDE, demande.statut)}`,
        ...(c.jetonPortail ? ["", "Suivre la demande dans votre espace copropriétaire :", lienPortail(c.jetonPortail)] : []),
        ...(telephone ? ["", `Pour toute question : ${telephone}`] : []),
        "",
        nomEntreprise,
      ],
    });
    return true;
  } catch (e) {
    console.error("Avis de demande non envoyé :", e.message || e);
    return false;
  }
}

// Le statut d'un bon de travail fait avancer celui de sa demande
export const STATUT_DEMANDE_SELON_TRAVAIL = { A_PLANIFIER: "ACCEPTEE", PLANIFIE: "ACCEPTEE", EN_COURS: "EN_COURS", TERMINE: "TERMINEE" };
