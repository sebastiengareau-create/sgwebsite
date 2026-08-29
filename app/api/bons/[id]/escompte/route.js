import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { montant, raison } = await request.json();
  const escompteMontant = Number(montant);
  if (isNaN(escompteMontant) || escompteMontant < 0) {
    return NextResponse.json({ erreur: "Montant invalide." }, { status: 400 });
  }

  const bon = await prisma.bonTravail.update({
    where: { id: params.id },
    data: { escompteMontant, escompteRaison: raison || null },
  });
  return NextResponse.json(bon);
}
