import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionImmo, refus, erreur, preparerFichier } from "@/lib/immobilier";

const MAX_PAR_ENVOI = 10;

// Photos et pièces jointes d'une réparation (multipart/form-data) :
// reparationId, puis un ou plusieurs « fichier »
export async function POST(request) {
  const session = await sessionImmo();
  if (!session) return refus();
  const formulaire = await request.formData().catch(() => null);
  const reparationId = formulaire?.get("reparationId");
  if (!reparationId || typeof reparationId !== "string") return erreur("Indique la réparation.");
  const fichiers = formulaire.getAll("fichier").filter((f) => typeof f !== "string").slice(0, MAX_PAR_ENVOI);
  if (fichiers.length === 0) return erreur("Aucun fichier reçu.");
  const prets = [];
  for (const f of fichiers) {
    const p = await preparerFichier(f);
    if (p.erreur) return erreur(p.erreur);
    prets.push(p);
  }
  try {
    await prisma.fichierImmo.createMany({ data: prets.map((p) => ({ ...p, reparationId, ajoutePar: session.nom })) });
  } catch (e) {
    if (e?.code === "P2003") return erreur("Réparation introuvable.", 404);
    throw e;
  }
  return NextResponse.json({ ok: true, ajoutes: prets.length });
}
