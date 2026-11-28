import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage } from "@/lib/elevage";
import { refusPeriodeElevage, livresElevage } from "@/lib/elevageCompta";

// Annule une vente entrée par erreur : ses paquets reviennent en stock
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const vente = await prisma.venteViande.findUnique({ where: { id: params.id } });
  if (!vente) return NextResponse.json({ erreur: "Vente introuvable." }, { status: 404 });
  const refus = await refusPeriodeElevage({ anciennes: [vente.date] });
  if (refus) return refus;
  await prisma.venteViande.delete({ where: { id: vente.id } });
  return NextResponse.json({ ok: true, ...(await livresElevage(session)) });
}
