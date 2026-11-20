import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionElevage } from "@/lib/elevage";

// Marque des événements du registre comme déclarés à Agri-Traçabilité
// Québec, ou retire la marque : { cles: [...], declare: true | false }
export async function POST(request) {
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { cles, declare } = await request.json();
  const liste = (Array.isArray(cles) ? cles : []).map(String).filter((c) => /^(naissance|achat|depl|boucle|abattage|vente|mort):[A-Za-z0-9_-]+$/.test(c)).slice(0, 2000);
  if (liste.length === 0) return NextResponse.json({ erreur: "Aucun événement choisi." }, { status: 400 });
  if (declare) await prisma.declarationAtq.createMany({ data: liste.map((cle) => ({ cle, declarePar: session.nom })), skipDuplicates: true });
  else await prisma.declarationAtq.deleteMany({ where: { cle: { in: liste } } });
  return NextResponse.json({ ok: true });
}
