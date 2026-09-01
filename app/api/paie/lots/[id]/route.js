import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirChecklistLot } from "@/lib/checklistLot";

export async function GET(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const lot = await prisma.lotPaie.findUnique({
    where: { id: params.id },
    include: { paies: { include: { employe: true }, orderBy: { creeLe: "asc" } } },
  });
  if (!lot) return NextResponse.json({ erreur: "Lot introuvable." }, { status: 404 });

  const checklist = lot.statut === "BROUILLON" ? await obtenirChecklistLot(lot.paies) : null;

  return NextResponse.json({ lot, checklist });
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const lot = await prisma.lotPaie.findUnique({ where: { id: params.id } });
  if (!lot) return NextResponse.json({ erreur: "Lot introuvable." }, { status: 404 });
  if (lot.statut !== "BROUILLON") {
    return NextResponse.json({ erreur: "Ce lot est déjà comptabilisé — il ne peut plus être supprimé au complet." }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.paie.deleteMany({ where: { lotId: lot.id } });
    await tx.lotPaie.delete({ where: { id: lot.id } });
  });

  return NextResponse.json({ ok: true });
}
