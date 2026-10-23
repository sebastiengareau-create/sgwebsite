import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const { pourcent, raison } = await request.json();
  const escomptePourcent = Number(pourcent || 0);
  if (isNaN(escomptePourcent) || escomptePourcent < 0 || escomptePourcent > 100) {
    return NextResponse.json({ erreur: "Pourcentage invalide (entre 0 et 100)." }, { status: 400 });
  }

  // Le pourcentage remplace l'ancien escompte en dollars
  const bon = await prisma.bonTravail.update({
    where: { id: params.id },
    data: { escomptePourcent, escompteMontant: 0, escompteRaison: raison || null },
  });
  return NextResponse.json(bon);
}
