import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionImmo, refus, erreur, normaliserModele, preparerFichier } from "@/lib/immobilier";

// Ajoute un document (multipart/form-data) : fichier + titre, categorie,
// date, expireLe, description, immeubleId, logementId, bailId, locataireId
export async function POST(request) {
  const session = await sessionImmo();
  if (!session) return refus();
  const formulaire = await request.formData().catch(() => null);
  if (!formulaire) return erreur("Formulaire invalide.");
  const champs = Object.fromEntries([...formulaire.entries()].filter(([, v]) => typeof v === "string"));
  const fichier = await preparerFichier(formulaire.get("fichier"));
  if (fichier.erreur) return erreur(fichier.erreur);
  if (!champs.titre) champs.titre = fichier.nom.replace(/\.[a-z0-9]+$/i, "");
  const r = normaliserModele("document", champs, { creation: true });
  if (r.erreur) return erreur(r.erreur);
  // Un document d'un logement ou d'un bail se range aussi sous son immeuble
  if (!r.data.immeubleId && (r.data.logementId || r.data.bailId)) {
    const logement = r.data.logementId
      ? await prisma.logementImmo.findUnique({ where: { id: r.data.logementId }, select: { immeubleId: true } })
      : (await prisma.bailImmo.findUnique({ where: { id: r.data.bailId }, select: { logement: { select: { immeubleId: true } } } }))?.logement;
    if (logement) r.data.immeubleId = logement.immeubleId;
  }
  try {
    const doc = await prisma.documentImmo.create({ data: { ...r.data, ...fichier, creePar: session.nom }, select: { id: true } });
    return NextResponse.json({ ok: true, id: doc.id });
  } catch (e) {
    if (e?.code === "P2003") return erreur("Immeuble, logement, bail ou locataire introuvable.", 404);
    throw e;
  }
}
