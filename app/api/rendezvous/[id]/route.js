import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();
  const data = {};
  if (body.statut && ["CONFIRME", "ANNULE", "COMPLETE"].includes(body.statut)) data.statut = body.statut;
  if (body.date) data.date = new Date(body.date);
  if (body.dureeMinutes) data.dureeMinutes = Number(body.dureeMinutes);
  if (body.motif) data.motif = body.motif;

  const rdv = await prisma.rendezVous.update({ where: { id: params.id }, data });
  return NextResponse.json(rdv);
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  await prisma.rendezVous.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
