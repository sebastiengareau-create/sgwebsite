import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage, normaliserCoupe } from "@/lib/elevage";

export async function POST(request) {
  if (!(await sessionElevage())) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const coupe = normaliserCoupe(await request.json());
  if (coupe.erreur) return NextResponse.json({ erreur: coupe.erreur }, { status: 400 });
  if (!coupe.data.nom || coupe.data.rendement === undefined || coupe.data.poidsPaquet === undefined) {
    return NextResponse.json({ erreur: "Indique le nom, le rendement et le poids d'un paquet." }, { status: 400 });
  }
  if (await prisma.coupeViande.findUnique({ where: { nom: coupe.data.nom } })) {
    return NextResponse.json({ erreur: "Une coupe porte déjà ce nom." }, { status: 409 });
  }
  const dernier = await prisma.coupeViande.aggregate({ _max: { ordre: true } });
  await prisma.coupeViande.create({ data: { ...coupe.data, ordre: (dernier._max.ordre ?? -1) + 1 } });
  return NextResponse.json({ ok: true });
}
