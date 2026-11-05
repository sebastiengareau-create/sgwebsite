import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserCoupe } from "@/lib/elevage";

export async function PATCH(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const coupe = normaliserCoupe(await request.json());
  if (coupe.erreur) return NextResponse.json({ erreur: coupe.erreur }, { status: 400 });
  if (coupe.data.nom) {
    const meme = await prisma.coupeViande.findUnique({ where: { nom: coupe.data.nom } });
    if (meme && meme.id !== params.id) return NextResponse.json({ erreur: "Une coupe porte déjà ce nom." }, { status: 409 });
  }
  const { count } = await prisma.coupeViande.updateMany({ where: { id: params.id }, data: coupe.data });
  if (count === 0) return NextResponse.json({ erreur: "Coupe introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Supprime une coupe jamais utilisée ; une coupe qui a des lots se désactive
// plutôt (elle reste sur les bêtes déjà découpées)
export async function DELETE(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const coupe = await prisma.coupeViande.findUnique({ where: { id: params.id }, include: { _count: { select: { lots: true } } } });
  if (!coupe) return NextResponse.json({ erreur: "Coupe introuvable." }, { status: 404 });
  if (coupe._count.lots > 0) return NextResponse.json({ erreur: "Des bêtes ont déjà été découpées avec cette coupe — désactive-la plutôt." }, { status: 409 });
  await prisma.coupeViande.delete({ where: { id: coupe.id } });
  return NextResponse.json({ ok: true });
}
