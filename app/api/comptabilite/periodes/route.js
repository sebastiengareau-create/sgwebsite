import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { limitesMoisQuebec, dateAujourdhuiQuebec } from "@/lib/temps";

export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const annee = Number(searchParams.get("annee")) || Number(dateAujourdhuiQuebec().split("-")[0]);

  const periodesExistantes = await prisma.periodeComptable.findMany({ where: { annee } });
  const parMois = Object.fromEntries(periodesExistantes.map((p) => [p.mois, p]));

  const periodes = Array.from({ length: 12 }, (_, i) => {
    const mois = i + 1;
    const existante = parMois[mois];
    if (existante) return existante;
    const { debut, fin } = limitesMoisQuebec(annee, mois);
    return { annee, mois, dateDebut: debut, dateFin: fin, statut: "OUVERTE", statutParNom: null, statutLe: null };
  });

  return NextResponse.json(periodes);
}
