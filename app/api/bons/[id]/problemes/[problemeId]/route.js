import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

const CATEGORIES_VALIDES = ["MAIN_OEUVRE", "ALIGNEMENT", "REMORQUAGE", "ENTREPOSAGE", "AUTRE"];

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { categorieRevenu } = await request.json();
  if (!CATEGORIES_VALIDES.includes(categorieRevenu)) {
    return NextResponse.json({ erreur: "Catégorie invalide." }, { status: 400 });
  }

  const probleme = await prisma.probleme.update({ where: { id: params.problemeId }, data: { categorieRevenu } });
  return NextResponse.json(probleme);
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  await prisma.probleme.delete({ where: { id: params.problemeId } });
  return NextResponse.json({ ok: true });
}
