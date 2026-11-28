import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserFrais } from "@/lib/elevage";
import { refusPeriodeElevage, livresElevage } from "@/lib/elevageCompta";

// Élevage relié à la comptabilité (lib/elevageCompta.js) : les frais vont aux
// comptes à payer (payés tout de suite avec { payee: true }) ; refusés dans
// une période comptable verrouillée ou fermée.

export async function POST(request, props) {
  const params = await props.params;
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!bete) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });
  const body = await request.json();
  const frais = normaliserFrais(body);
  if (frais.erreur) return NextResponse.json({ erreur: frais.erreur }, { status: 400 });
  const refus = await refusPeriodeElevage({ nouvelles: [frais.data.date] });
  if (refus) return refus;
  const cree = await prisma.fraisBete.create({ data: { ...frais.data, beteId: bete.id } });
  return NextResponse.json({ ok: true, ...(await livresElevage(session, body.payee === true ? { [cree.id]: { mode: typeof body.modePaiement === "string" ? body.modePaiement : null } } : {})) });
}

// DELETE ?fraisId=…
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const fraisId = new URL(request.url).searchParams.get("fraisId");
  const frais = await prisma.fraisBete.findFirst({ where: { id: fraisId || "", beteId: params.id } });
  if (!frais) return NextResponse.json({ erreur: "Frais introuvable." }, { status: 404 });
  const refus = await refusPeriodeElevage({ anciennes: [frais.date] });
  if (refus) return refus;
  await prisma.fraisBete.delete({ where: { id: frais.id } });
  return NextResponse.json({ ok: true, ...(await livresElevage(session)) });
}
