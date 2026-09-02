import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const { taux } = await request.json();

  // taux vide/null = revenir au taux par défaut des Paramètres
  if (taux === null || taux === "" || taux === undefined) {
    const bon = await prisma.bonTravail.update({ where: { id: params.id }, data: { tauxHoraireOverride: null } });
    return NextResponse.json(bon);
  }

  const nouveauTaux = Number(taux);
  if (isNaN(nouveauTaux) || nouveauTaux <= 0) {
    return NextResponse.json({ erreur: "Taux horaire invalide." }, { status: 400 });
  }

  const bon = await prisma.bonTravail.update({ where: { id: params.id }, data: { tauxHoraireOverride: nouveauTaux } });
  return NextResponse.json(bon);
}
