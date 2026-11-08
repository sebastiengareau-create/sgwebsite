import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionCopro, refus, erreur, normaliserModele, preparerFichierCopro } from "@/lib/copropriete";

// Ajoute un document (multipart/form-data) : fichier + titre, categorie,
// date, description, visibilite, uniteId, batimentId
export async function POST(request) {
  const session = await sessionCopro();
  if (!session) return refus();
  const formulaire = await request.formData().catch(() => null);
  if (!formulaire) return erreur("Formulaire invalide.");
  const champs = Object.fromEntries([...formulaire.entries()].filter(([, v]) => typeof v === "string"));
  const fichier = await preparerFichierCopro(formulaire.get("fichier"));
  if (fichier.erreur) return erreur(fichier.erreur);
  if (!champs.titre) champs.titre = fichier.nom.replace(/\.[a-z0-9]+$/i, "");
  const r = normaliserModele("document", champs, { creation: true });
  if (r.erreur) return erreur(r.erreur);
  const doc = await prisma.documentCopro.create({ data: { ...r.data, ...fichier, creePar: session.nom }, select: { id: true } });
  return NextResponse.json({ ok: true, id: doc.id });
}
