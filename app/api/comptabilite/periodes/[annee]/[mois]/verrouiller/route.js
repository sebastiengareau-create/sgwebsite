import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { limitesMoisQuebec } from "@/lib/temps";

// Simple bascule OUVERTE → VERROUILLEE, sans checklist — utile en pleine
// révision de fin de mois (voir plan de fermeture de période).
export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const annee = Number(params.annee);
  const mois = Number(params.mois);

  const existante = await prisma.periodeComptable.findUnique({ where: { annee_mois: { annee, mois } } });
  const statutAvant = existante?.statut || "OUVERTE";
  if (statutAvant !== "OUVERTE") {
    return NextResponse.json({ erreur: "Cette période n'est pas ouverte." }, { status: 409 });
  }

  const { debut, fin } = limitesMoisQuebec(annee, mois);
  const periode = await prisma.periodeComptable.upsert({
    where: { annee_mois: { annee, mois } },
    update: { statut: "VERROUILLEE", statutParNom: session.nom, statutLe: new Date() },
    create: { annee, mois, dateDebut: debut, dateFin: fin, statut: "VERROUILLEE", statutParNom: session.nom, statutLe: new Date() },
  });

  await prisma.fermeturePeriodeHistorique.create({
    data: { periodeId: periode.id, action: "VERROUILLAGE", statutAvant, statutApres: "VERROUILLEE", parNom: session.nom },
  });

  return NextResponse.json(periode);
}
