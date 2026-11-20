import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserSoin } from "@/lib/elevage";

// Registre de santé : un soin (vaccin, vermifuge, traitement, visite), avec
// son délai de retrait et son rappel s'il y a lieu
export async function POST(request, props) {
  const params = await props.params;
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!bete) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });
  const soin = normaliserSoin(await request.json());
  if (soin.erreur) return NextResponse.json({ erreur: soin.erreur }, { status: 400 });
  await prisma.soinBete.create({ data: { ...soin.data, beteId: bete.id, creePar: session.nom } });
  return NextResponse.json({ ok: true });
}

// DELETE ?soinId=…
export async function DELETE(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const soinId = new URL(request.url).searchParams.get("soinId");
  const { count } = await prisma.soinBete.deleteMany({ where: { id: soinId || "", beteId: params.id } });
  if (count === 0) return NextResponse.json({ erreur: "Soin introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
