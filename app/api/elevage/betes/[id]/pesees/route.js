import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserPesee } from "@/lib/elevage";

export async function POST(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!bete) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });
  const pesee = normaliserPesee(await request.json());
  if (pesee.erreur) return NextResponse.json({ erreur: pesee.erreur }, { status: 400 });
  await prisma.peseeBete.create({ data: { ...pesee.data, beteId: bete.id } });
  return NextResponse.json({ ok: true });
}

// DELETE ?peseeId=…
export async function DELETE(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const peseeId = new URL(request.url).searchParams.get("peseeId");
  const { count } = await prisma.peseeBete.deleteMany({ where: { id: peseeId || "", beteId: params.id } });
  if (count === 0) return NextResponse.json({ erreur: "Pesée introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
