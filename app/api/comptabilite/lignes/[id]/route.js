import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { rapproche } = await request.json();
  const existante = await prisma.ligneEcriture.findUnique({ where: { id: params.id }, select: { rapprochementId: true } });
  if (!existante) return NextResponse.json({ erreur: "Ligne introuvable." }, { status: 404 });
  if (existante.rapprochementId) {
    return NextResponse.json({ erreur: "Cette ligne fait partie d'une conciliation déjà enregistrée." }, { status: 400 });
  }
  const ligne = await prisma.ligneEcriture.update({ where: { id: params.id }, data: { rapproche: !!rapproche } });
  return NextResponse.json(ligne);
}
