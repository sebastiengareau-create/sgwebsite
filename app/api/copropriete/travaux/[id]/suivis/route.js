import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionCopro, refus, erreur, aviserDemandeur } from "@/lib/copropriete";

// Note au suivi d'un bon de travail ; publique, elle paraît dans le portail
// du copropriétaire qui a fait la demande, et lui est envoyée par courriel
export async function POST(request, props) {
  const session = await sessionCopro();
  if (!session) return refus();
  const { id } = await props.params;
  const travail = await prisma.travailCopro.findUnique({ where: { id }, select: { id: true, demandeId: true } });
  if (!travail) return erreur("Bon de travail introuvable.", 404);
  const body = await request.json().catch(() => ({}));
  const texte = String(body.texte || "").trim().slice(0, 4000);
  if (!texte) return erreur("Écris la note.");
  const publique = body.public !== false;
  await prisma.suiviTravailCopro.create({ data: { travailId: id, texte, public: publique, auteur: session.nom } });
  if (publique && travail.demandeId && body.aviser !== false) await aviserDemandeur(travail.demandeId, texte);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, props) {
  if (!(await sessionCopro())) return refus();
  const { id } = await props.params;
  const suiviId = new URL(request.url).searchParams.get("suivi");
  await prisma.suiviTravailCopro.deleteMany({ where: { id: suiviId || "", travailId: id } });
  return NextResponse.json({ ok: true });
}
