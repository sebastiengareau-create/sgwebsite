import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserFrais } from "@/lib/elevage";

export async function POST(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!bete) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });
  const frais = normaliserFrais(await request.json());
  if (frais.erreur) return NextResponse.json({ erreur: frais.erreur }, { status: 400 });
  await prisma.fraisBete.create({ data: { ...frais.data, beteId: bete.id } });
  return NextResponse.json({ ok: true });
}

// DELETE ?fraisId=…
export async function DELETE(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const fraisId = new URL(request.url).searchParams.get("fraisId");
  const { count } = await prisma.fraisBete.deleteMany({ where: { id: fraisId || "", beteId: params.id } });
  if (count === 0) return NextResponse.json({ erreur: "Frais introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
