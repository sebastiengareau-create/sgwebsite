import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserRemplacementBoucle, verifierBoucle } from "@/lib/elevage";

// Remplace la boucle d'une bête (perdue, illisible…) : l'ancienne passe à
// son historique, la nouvelle devient sa boucle en service
export async function POST(request, props) {
  const params = await props.params;
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, select: { id: true, identifiant: true } });
  if (!bete) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });
  if (!bete.identifiant) return NextResponse.json({ erreur: "Cette bête n'a pas encore de boucle — inscris-la dans sa fiche." }, { status: 400 });
  const remplacement = normaliserRemplacementBoucle(await request.json());
  if (remplacement.erreur) return NextResponse.json({ erreur: remplacement.erreur }, { status: 400 });
  if (remplacement.data.remplaceePar === bete.identifiant) return NextResponse.json({ erreur: "C'est déjà sa boucle." }, { status: 400 });
  const libre = await verifierBoucle(remplacement.data.remplaceePar, bete.id);
  if (libre.erreur) return NextResponse.json({ erreur: libre.erreur }, { status: 400 });
  await prisma.$transaction([
    prisma.boucleBete.create({ data: { ...remplacement.data, numero: bete.identifiant, beteId: bete.id, creePar: session.nom } }),
    prisma.bete.update({ where: { id: bete.id }, data: { identifiant: remplacement.data.remplaceePar } }),
  ]);
  return NextResponse.json({ ok: true });
}

// DELETE ?boucleId=… — annule un remplacement entré par erreur : seulement
// le dernier, et l'ancienne boucle redevient celle de la bête
export async function DELETE(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const boucleId = new URL(request.url).searchParams.get("boucleId");
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, select: { id: true, identifiant: true, boucles: true } });
  const boucle = bete?.boucles.find((b) => b.id === boucleId);
  if (!boucle) return NextResponse.json({ erreur: "Remplacement introuvable." }, { status: 404 });
  if (boucle.remplaceePar !== bete.identifiant) return NextResponse.json({ erreur: "Seul le dernier remplacement peut être annulé." }, { status: 409 });
  await prisma.$transaction([
    prisma.bete.update({ where: { id: bete.id }, data: { identifiant: boucle.numero } }),
    prisma.boucleBete.delete({ where: { id: boucle.id } }),
    prisma.declarationAtq.deleteMany({ where: { cle: `boucle:${boucle.id}` } }),
  ]);
  return NextResponse.json({ ok: true });
}
