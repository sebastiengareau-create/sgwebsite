import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { actif } = await request.json();
  const immobilisation = await prisma.immobilisation.update({ where: { id: params.id }, data: { actif: !!actif } });
  return NextResponse.json(immobilisation);
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  // Retire aussi l'écriture d'acquisition liée
  await prisma.ecritureComptable.deleteMany({ where: { source: "IMMOBILISATION_ACQUISE", sourceId: params.id } });
  await prisma.immobilisation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
