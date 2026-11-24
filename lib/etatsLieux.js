// État des lieux numérique (module Immobilier) — à l'entrée et à la sortie
// d'un locataire, depuis la fiche du bail.
//
//   1. On le commence depuis le bail : la grille de départ suit le nombre
//      de pièces du logement (lib/etatsLieuxCalculs.js) ; à la sortie, on
//      reprend les pièces et les éléments de l'entrée pour comparer.
//   2. On le remplit sur place, au téléphone : l'état de chaque élément, une
//      remarque, des photos ; les compteurs et les clés remises.
//   3. Terminé, il devient un PDF (photos en annexe) rangé dans les
//      documents du bail et visible dans le portail du locataire — et, au
//      choix, envoyé à la signature électronique du locateur et des
//      locataires (lib/signatureImmo.js). Tant qu'une signature est demandée,
//      il ne se rouvre plus.
import { prisma } from "./prisma";
import { genererDocumentBail, VALEURS_SERVEUR } from "./immobilier";
import { piecesParDefaut, piecesPourSortie, normaliserPieces, normaliserCompteurs, comparerAEntree, dommagesDepuisEntree, avancement } from "./etatsLieuxCalculs";

export const TAILLE_MAX_PHOTO = 4 * 1024 * 1024; // caractères de la data URL (photo déjà réduite dans le navigateur)
export const PHOTOS_MAX = 300;

const aujourdhuiMidi = () => new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date())}T12:00:00Z`);

const INCLURE = {
  bail: {
    select: {
      id: true, statut: true, dateDebut: true, dateFin: true, logementId: true,
      logement: { select: { id: true, numero: true, type: true, pieces: true, adresseCivique: true, immeuble: { select: { id: true, nom: true, adresse: true, ville: true, codePostal: true } } } },
      locataires: { select: { id: true, nom: true } },
    },
  },
  photos: { select: { id: true, element: true }, orderBy: { creeLe: "asc" } },
};

// L'entrée qui sert de référence à une sortie : celle du même bail (la
// terminée d'abord) — jamais celle d'un autre locataire
function entreeDuBail(bailId, saufId = "") {
  return prisma.etatLieuxImmo.findFirst({ where: { moment: "ENTREE", bailId, ...(saufId ? { id: { not: saufId } } : {}) }, orderBy: [{ statut: "desc" }, { date: "desc" }] });
}

// Commence un état des lieux → { id } (celui déjà en cours, s'il y en a un)
export async function creerEtatLieux(bailId, moment, creePar) {
  if (!["ENTREE", "SORTIE"].includes(moment)) return { erreur: "Entrée ou sortie ?" };
  const bail = await prisma.bailImmo.findUnique({ where: { id: bailId }, select: { id: true, logementId: true, logement: { select: { type: true, pieces: true } } } });
  if (!bail) return { erreur: "Bail introuvable." };
  const enCours = await prisma.etatLieuxImmo.findFirst({ where: { bailId, moment, statut: "EN_COURS" }, select: { id: true } });
  if (enCours) return { id: enCours.id };
  let pieces = piecesParDefaut(bail.logement);
  if (moment === "SORTIE") {
    // Les pièces de l'entrée du bail, sinon celles du dernier état des lieux du logement
    const modele = (await entreeDuBail(bailId)) || (await prisma.etatLieuxImmo.findFirst({ where: { bail: { logementId: bail.logementId } }, orderBy: { date: "desc" } }));
    if (modele) pieces = piecesPourSortie(modele.pieces);
  }
  const e = await prisma.etatLieuxImmo.create({ data: { bailId, moment, date: aujourdhuiMidi(), pieces, creePar }, select: { id: true } });
  return { id: e.id };
}

// L'état des lieux, son bail, ses photos, et pour une sortie, l'entrée de référence
export async function etatLieuxComplet(id) {
  const etat = await prisma.etatLieuxImmo.findUnique({ where: { id }, include: INCLURE });
  if (!etat) return null;
  const entree = etat.moment === "SORTIE" ? await entreeDuBail(etat.bailId, etat.id) : null;
  let document = null;
  if (etat.documentId) document = await prisma.documentImmo.findUnique({ where: { id: etat.documentId }, select: { id: true, titre: true, signeLe: true, signatures: { select: { statut: true } } } });
  return { etat, entree: entree ? { id: entree.id, date: entree.date, statut: entree.statut, pieces: entree.pieces } : null, document };
}

async function modifiable(id) {
  const etat = await prisma.etatLieuxImmo.findUnique({ where: { id } });
  if (!etat) return { erreur: "État des lieux introuvable.", status: 404 };
  if (etat.statut !== "EN_COURS") return { erreur: "Cet état des lieux est terminé : rouvre-le pour le modifier.", status: 409 };
  return { etat };
}

// Enregistre ce qui a été rempli : { pieces, compteurs, notes, date }
export async function majEtatLieux(id, body) {
  const m = await modifiable(id);
  if (m.erreur) return m;
  const data = {};
  if (body.pieces !== undefined) {
    const r = normaliserPieces(body.pieces);
    if (r.erreur) return r;
    data.pieces = r.pieces;
  }
  if (body.compteurs !== undefined) data.compteurs = normaliserCompteurs(body.compteurs);
  if (body.notes !== undefined) data.notes = String(body.notes || "").slice(0, 4000) || null;
  if (body.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")) return { erreur: "Date invalide." };
    data.date = new Date(`${body.date}T12:00:00Z`);
  }
  await prisma.etatLieuxImmo.update({ where: { id }, data });
  // Photos d'éléments retirés de la grille
  if (data.pieces) {
    const cles = data.pieces.flatMap((p) => p.elements.map((e) => e.cle));
    await prisma.photoEtatLieuxImmo.deleteMany({ where: { etatId: id, element: { notIn: cles } } });
  }
  return { ok: true };
}

export async function ajouterPhoto(id, element, dataUrl) {
  const m = await modifiable(id);
  if (m.erreur) return m;
  if (!m.etat.pieces.some((p) => p.elements.some((e) => e.cle === element))) return { erreur: "Élément introuvable." };
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl || "") || dataUrl.length > TAILLE_MAX_PHOTO) return { erreur: "Photo invalide ou trop lourde." };
  if ((await prisma.photoEtatLieuxImmo.count({ where: { etatId: id } })) >= PHOTOS_MAX) return { erreur: `${PHOTOS_MAX} photos au plus par état des lieux.` };
  return prisma.photoEtatLieuxImmo.create({ data: { etatId: id, element, url: dataUrl }, select: { id: true, element: true } });
}

export async function supprimerPhoto(id, photoId) {
  const m = await modifiable(id);
  if (m.erreur) return m;
  await prisma.photoEtatLieuxImmo.deleteMany({ where: { id: photoId, etatId: id } });
  return { ok: true };
}

// Une signature demandée (en attente ou reçue) bloque toute modification
async function signatureDemandee(documentId) {
  if (!documentId) return false;
  return (await prisma.signatureImmo.count({ where: { documentId, statut: { not: "ANNULE" } } })) > 0;
}

// Termine : génère le PDF dans les documents du bail ; faireSigner : demande
// la signature en ligne au locateur et à tous les locataires (lien par
// courriel à ceux qui en ont un) → { documentId, signature }
export async function terminerEtatLieux(id, { faireSigner = false } = {}, creePar) {
  const m = await modifiable(id);
  if (m.erreur) return m;
  const etat = await prisma.etatLieuxImmo.findUnique({ where: { id }, include: INCLURE });
  const { notes: notesElements } = avancement(etat.pieces);
  if (notesElements === 0) return { erreur: "Note l'état d'au moins un élément avant de terminer." };
  const photos = {};
  for (const p of etat.photos) (photos[p.element] ||= []).push(p.id);
  const entree = etat.moment === "SORTIE" ? await entreeDuBail(etat.bailId, etat.id) : null;
  const doc = await genererDocumentBail(etat.bailId, "ETAT_LIEUX_NUMERIQUE", {
    [VALEURS_SERVEUR]: true,
    moment: etat.moment, dateAvis: etat.date.toISOString().slice(0, 10), pieces: etat.pieces, compteurs: etat.compteurs || {}, notes: etat.notes || "", photos,
    comparaison: entree ? comparerAEntree(entree.pieces, etat.pieces) : null,
    dommages: entree ? dommagesDepuisEntree(entree.pieces, etat.pieces) : null,
    dateEntree: entree?.date || null,
  }, creePar);
  if (doc.erreur) return doc;
  await prisma.etatLieuxImmo.update({ where: { id }, data: { statut: "TERMINE", documentId: doc.id, termineLe: new Date() } });
  let signature = null;
  if (faireSigner) {
    const { demanderSignatures } = await import("./signatureImmo");
    signature = await demanderSignatures(doc.id, { locataireIds: etat.bail.locataires.map((l) => l.id), locateur: true, envoyer: true, creePar });
  }
  return { documentId: doc.id, signature };
}

// Rouvre un état des lieux terminé pour le corriger : son PDF est retiré.
// Impossible une fois une signature demandée.
export async function rouvrirEtatLieux(id) {
  const etat = await prisma.etatLieuxImmo.findUnique({ where: { id } });
  if (!etat) return { erreur: "État des lieux introuvable." };
  if (etat.statut !== "TERMINE") return { ok: true };
  if (await signatureDemandee(etat.documentId)) return { erreur: "Une signature a été demandée pour cet état des lieux : annule-la d'abord dans les documents du bail." };
  if (etat.documentId) await prisma.documentImmo.deleteMany({ where: { id: etat.documentId } });
  await prisma.etatLieuxImmo.update({ where: { id }, data: { statut: "EN_COURS", documentId: null, termineLe: null } });
  return { ok: true };
}

export async function supprimerEtatLieux(id) {
  const etat = await prisma.etatLieuxImmo.findUnique({ where: { id } });
  if (!etat) return { ok: true };
  if (await signatureDemandee(etat.documentId)) return { erreur: "Cet état des lieux a été envoyé à la signature : il reste au dossier." };
  if (etat.documentId) await prisma.documentImmo.deleteMany({ where: { id: etat.documentId } });
  await prisma.etatLieuxImmo.delete({ where: { id } });
  return { ok: true, bailId: etat.bailId };
}
