import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserBete, normaliserSortie, verifierMere } from "@/lib/elevage";

// Modifie la fiche ; avec { sortie }, change le statut : vendue sur pied,
// morte, ou retour au troupeau (l'abattage a sa propre route)
export async function PATCH(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, include: { abattage: { select: { id: true } } } });
  if (!bete) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });

  const body = await request.json();
  if (body.sortie) {
    if (bete.abattage) return NextResponse.json({ erreur: "Cette bête est abattue — annule l'abattage pour changer son statut." }, { status: 409 });
    const sortie = normaliserSortie(body.sortie);
    if (sortie.erreur) return NextResponse.json({ erreur: sortie.erreur }, { status: 400 });
    await prisma.bete.update({ where: { id: bete.id }, data: sortie.data });
    return NextResponse.json({ ok: true });
  }

  const fiche = normaliserBete(body);
  if (fiche.erreur) return NextResponse.json({ erreur: fiche.erreur }, { status: 400 });
  if (fiche.data.mereId !== undefined) {
    const mere = await verifierMere(fiche.data.mereId, bete.id);
    if (mere.erreur) return NextResponse.json({ erreur: mere.erreur }, { status: 400 });
  }
  await prisma.bete.update({ where: { id: bete.id }, data: fiche.data });
  return NextResponse.json({ ok: true });
}

// Retire une fiche entrée par erreur — pas une bête abattue (sa viande est
// reliée à elle) : annuler l'abattage d'abord
export async function DELETE(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, include: { abattage: { select: { id: true } } } });
  if (!bete) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });
  if (bete.abattage) return NextResponse.json({ erreur: "Cette bête est abattue — sa fiche reste pour la traçabilité de sa viande." }, { status: 409 });
  await prisma.bete.delete({ where: { id: bete.id } });
  return NextResponse.json({ ok: true });
}
