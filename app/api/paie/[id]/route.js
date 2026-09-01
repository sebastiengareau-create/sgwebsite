import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { verifierPeriodeModifiable } from "@/lib/comptabilite";

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const paie = await prisma.paie.findUnique({ where: { id: params.id } });
  if (!paie) return NextResponse.json({ erreur: "Paie introuvable." }, { status: 404 });

  try {
    await verifierPeriodeModifiable(paie.dateVersement || paie.periodeFin, { nouvellePiece: false });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  // Retire aussi l'écriture comptable liée (si la comptabilité était active
  // au moment de la paie), pour garder les livres cohérents
  await prisma.ecritureComptable.deleteMany({ where: { source: "PAIE", sourceId: params.id } });
  await prisma.paie.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
