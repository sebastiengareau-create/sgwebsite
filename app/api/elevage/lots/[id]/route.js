import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserLot } from "@/lib/elevage";

// Corrige les paquets reçus d'une coupe (compte du boucher, paquet abîmé…) —
// jamais sous le nombre déjà vendu
export async function PATCH(request, props) {
  const params = await props.params;
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const lot = await prisma.lotViande.findUnique({ where: { id: params.id }, include: { ventes: { select: { nbPaquets: true } } } });
  if (!lot) return NextResponse.json({ erreur: "Lot introuvable." }, { status: 404 });
  const donnees = normaliserLot(await request.json());
  if (donnees.erreur) return NextResponse.json({ erreur: donnees.erreur }, { status: 400 });
  const vendus = lot.ventes.reduce((s, v) => s + v.nbPaquets, 0);
  if (donnees.data.nbPaquets < vendus) {
    return NextResponse.json({ erreur: `${vendus} paquet${vendus > 1 ? "s sont" : " est"} déjà vendu${vendus > 1 ? "s" : ""} dans ce lot.` }, { status: 409 });
  }
  await prisma.lotViande.update({ where: { id: lot.id }, data: donnees.data });
  return NextResponse.json({ ok: true });
}
