import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionCopro, refus, erreur, preparerFichierCopro } from "@/lib/copropriete";

const MAX_PAR_ENVOI = 10;

// Photos et pièces jointes (multipart/form-data) : demandeId ou travailId,
// puis un ou plusieurs « fichier »
export async function POST(request) {
  const session = await sessionCopro();
  if (!session) return refus();
  const formulaire = await request.formData().catch(() => null);
  const demandeId = formulaire?.get("demandeId") || null;
  const travailId = formulaire?.get("travailId") || null;
  if (!demandeId === !travailId) return erreur("Indique la demande ou le bon de travail.");
  const fichiers = formulaire.getAll("fichier").filter((f) => typeof f !== "string").slice(0, MAX_PAR_ENVOI);
  if (fichiers.length === 0) return erreur("Aucun fichier reçu.");
  const prets = [];
  for (const f of fichiers) {
    const p = await preparerFichierCopro(f);
    if (p.erreur) return erreur(p.erreur);
    prets.push(p);
  }
  try {
    await prisma.fichierCopro.createMany({ data: prets.map((p) => ({ ...p, demandeId, travailId, ajoutePar: session.nom })) });
  } catch (e) {
    if (e?.code === "P2003") return erreur("Demande ou bon de travail introuvable.", 404);
    throw e;
  }
  return NextResponse.json({ ok: true, ajoutes: prets.length });
}
