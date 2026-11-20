import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserDeplacement } from "@/lib/elevage";

// Déplace une ou plusieurs bêtes d'un coup (un groupe qui change de
// pâturage, un chargement vers un autre site) : { beteIds, date, type,
// lieu, site, transporteur, note }
export async function POST(request) {
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const body = await request.json();
  const ids = [...new Set(Array.isArray(body.beteIds) ? body.beteIds.map(String) : [])];
  if (ids.length === 0) return NextResponse.json({ erreur: "Choisis au moins une bête." }, { status: 400 });
  const deplacement = normaliserDeplacement(body);
  if (deplacement.erreur) return NextResponse.json({ erreur: deplacement.erreur }, { status: 400 });
  const betes = await prisma.bete.findMany({ where: { id: { in: ids } }, select: { id: true, numero: true, statut: true } });
  if (betes.length !== ids.length) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });
  const sortie = betes.find((b) => b.statut !== "ACTIVE");
  if (sortie) return NextResponse.json({ erreur: `${sortie.numero} n'est plus au troupeau.` }, { status: 409 });
  await prisma.deplacementBete.createMany({ data: betes.map((b) => ({ ...deplacement.data, beteId: b.id, creePar: session.nom })) });
  return NextResponse.json({ ok: true, nombre: betes.length });
}

// DELETE ?id=… — déplacement entré par erreur
export async function DELETE(request) {
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") || "";
  const { count } = await prisma.deplacementBete.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ erreur: "Déplacement introuvable." }, { status: 404 });
  await prisma.declarationAtq.deleteMany({ where: { cle: `depl:${id}` } });
  return NextResponse.json({ ok: true });
}
