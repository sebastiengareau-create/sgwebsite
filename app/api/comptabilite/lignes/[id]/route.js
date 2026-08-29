import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { rapproche } = await request.json();
  const ligne = await prisma.ligneEcriture.update({ where: { id: params.id }, data: { rapproche: !!rapproche } });
  return NextResponse.json(ligne);
}
