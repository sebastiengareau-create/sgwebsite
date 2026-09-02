import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { dateHeureLocaleVersUTC } from "@/lib/temps";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const entreeExistante = await prisma.entreeTemps.findUnique({ where: { id: params.id }, include: { probleme: true } });
  if (!entreeExistante) return NextResponse.json({ erreur: "Entrée introuvable." }, { status: 404 });
  if (await bonEstVerrouille(entreeExistante.probleme.bonId)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const { debut, fin } = await request.json();
  const data = {};
  if (debut) data.debut = dateHeureLocaleVersUTC(debut);
  if (fin) data.fin = dateHeureLocaleVersUTC(fin);

  if (data.debut && data.fin && data.fin <= data.debut) {
    return NextResponse.json({ erreur: "L'heure de fin doit être après le début." }, { status: 400 });
  }

  const entree = await prisma.entreeTemps.update({ where: { id: params.id }, data });
  return NextResponse.json(entree);
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const entreeExistante = await prisma.entreeTemps.findUnique({ where: { id: params.id }, include: { probleme: true } });
  if (!entreeExistante) return NextResponse.json({ erreur: "Entrée introuvable." }, { status: 404 });
  if (await bonEstVerrouille(entreeExistante.probleme.bonId)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  await prisma.entreeTemps.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
