import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionCopro, refus, erreur, reponseFichier } from "@/lib/copropriete";

export async function GET(request, props) {
  if (!(await sessionCopro())) return refus();
  const { id } = await props.params;
  const f = await prisma.fichierCopro.findUnique({ where: { id } });
  if (!f) return erreur("Fichier introuvable.", 404);
  return reponseFichier(f, request);
}

export async function DELETE(request, props) {
  if (!(await sessionCopro())) return refus();
  const { id } = await props.params;
  await prisma.fichierCopro.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
