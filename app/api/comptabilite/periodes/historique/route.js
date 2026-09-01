import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const annee = searchParams.get("annee");

  const historique = await prisma.fermeturePeriodeHistorique.findMany({
    where: annee ? { periode: { annee: Number(annee) } } : undefined,
    include: { periode: true },
    orderBy: { creeLe: "desc" },
    take: 200,
  });

  return NextResponse.json(historique);
}
