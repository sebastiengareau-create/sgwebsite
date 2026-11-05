import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserAbattage, normaliserLot } from "@/lib/elevage";

// Abattage et découpe : la carcasse, puis les paquets reçus du boucher pour
// chaque coupe (proposés selon les rendements, corrigés au besoin). Une
// coupe à 0 paquet n'a pas de lot. La bête sort du troupeau.
export async function POST(request, props) {
  const params = await props.params;
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const bete = await prisma.bete.findUnique({ where: { id: params.id }, include: { abattage: { select: { id: true } } } });
  if (!bete) return NextResponse.json({ erreur: "Bête introuvable." }, { status: 404 });
  if (bete.abattage) return NextResponse.json({ erreur: "Cette bête est déjà abattue." }, { status: 409 });
  if (bete.statut !== "ACTIVE") return NextResponse.json({ erreur: "Cette bête n'est plus au troupeau — remets-la au troupeau d'abord." }, { status: 409 });

  const body = await request.json();
  const abattage = normaliserAbattage(body);
  if (abattage.erreur) return NextResponse.json({ erreur: abattage.erreur }, { status: 400 });

  const coupes = await prisma.coupeViande.findMany({ select: { id: true, nom: true } });
  const lots = [];
  for (const l of Array.isArray(body.lots) ? body.lots : []) {
    const coupe = coupes.find((c) => c.id === l.coupeId);
    if (!coupe) return NextResponse.json({ erreur: "Coupe introuvable." }, { status: 400 });
    if (lots.some((x) => x.coupeId === coupe.id)) return NextResponse.json({ erreur: `${coupe.nom} est en double.` }, { status: 400 });
    const lot = normaliserLot(l);
    if (lot.erreur) return NextResponse.json({ erreur: `${coupe.nom} : ${lot.erreur}` }, { status: 400 });
    if (lot.data.nbPaquets === 0) continue;
    lots.push({ ...lot.data, coupeId: coupe.id, paquetsEstimes: Math.max(0, Math.floor(Number(l.paquetsEstimes) || 0)) });
  }

  await prisma.$transaction([
    prisma.abattage.create({ data: { ...abattage.data, beteId: bete.id, creePar: session.nom, lots: { create: lots } } }),
    prisma.bete.update({ where: { id: bete.id }, data: { statut: "ABATTUE", dateSortie: abattage.data.date } }),
  ]);
  return NextResponse.json({ ok: true });
}

// Annule un abattage entré par erreur — seulement si aucun paquet n'est
// vendu. La bête revient au troupeau.
export async function DELETE(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const abattage = await prisma.abattage.findUnique({ where: { beteId: params.id }, include: { lots: { select: { _count: { select: { ventes: true } } } } } });
  if (!abattage) return NextResponse.json({ erreur: "Aucun abattage pour cette bête." }, { status: 404 });
  if (abattage.lots.some((l) => l._count.ventes > 0)) {
    return NextResponse.json({ erreur: "Des paquets de cette bête sont déjà vendus — annule ces ventes d'abord (Élevage → Viande)." }, { status: 409 });
  }
  await prisma.$transaction([
    prisma.abattage.delete({ where: { id: abattage.id } }),
    prisma.bete.update({ where: { id: params.id }, data: { statut: "ACTIVE", dateSortie: null } }),
  ]);
  return NextResponse.json({ ok: true });
}
