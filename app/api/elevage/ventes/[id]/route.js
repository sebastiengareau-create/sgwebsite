import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage } from "@/lib/elevage";

// Annule une vente entrée par erreur : ses paquets reviennent en stock
export async function DELETE(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { count } = await prisma.venteViande.deleteMany({ where: { id: params.id } });
  if (count === 0) return NextResponse.json({ erreur: "Vente introuvable." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
