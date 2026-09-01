import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";

// Réservé au gérant/développeur, motif obligatoire — voir plan de fermeture
// de période. Jamais accessible via aAccesSection("comptabilite") seul.
export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Seul le gérant ou le développeur peut rouvrir une période." }, { status: 403 });
  }

  const { motif } = await request.json().catch(() => ({}));
  if (!motif || !motif.trim()) {
    return NextResponse.json({ erreur: "Un motif est requis pour rouvrir une période." }, { status: 400 });
  }

  const annee = Number(params.annee);
  const mois = Number(params.mois);

  const existante = await prisma.periodeComptable.findUnique({ where: { annee_mois: { annee, mois } } });
  const statutAvant = existante?.statut || "OUVERTE";
  if (statutAvant === "OUVERTE") {
    return NextResponse.json({ erreur: "Cette période est déjà ouverte." }, { status: 409 });
  }

  const periode = await prisma.periodeComptable.update({
    where: { annee_mois: { annee, mois } },
    data: { statut: "OUVERTE", statutParNom: session.nom, statutLe: new Date() },
  });

  await prisma.fermeturePeriodeHistorique.create({
    data: { periodeId: periode.id, action: "REOUVERTURE", statutAvant, statutApres: "OUVERTE", parNom: session.nom, motif: motif.trim() },
  });

  return NextResponse.json(periode);
}
