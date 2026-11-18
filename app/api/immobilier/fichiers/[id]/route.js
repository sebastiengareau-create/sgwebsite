import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionImmo, refus, erreur, reponseFichier } from "@/lib/immobilier";

export async function GET(request, props) {
  if (!(await sessionImmo())) return refus();
  const { id } = await props.params;
  const f = await prisma.fichierImmo.findUnique({ where: { id } });
  if (!f) return erreur("Fichier introuvable.", 404);
  return reponseFichier(f, request);
}

export async function DELETE(request, props) {
  if (!(await sessionImmo())) return refus();
  const { id } = await props.params;
  await prisma.fichierImmo.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
