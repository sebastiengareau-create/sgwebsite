import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLIENT } from "@/lib/client";
import { CLE_GRILLES } from "@/lib/inspections";
import { grillesParDefaut, normaliserGrilles } from "@/lib/grillesInspection";

// Grilles d'inspection du garage (Paramètres → Grilles d'inspection). Elles
// servent aux prochaines inspections ; celles déjà faites gardent leurs points.
export async function PUT(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { grilles } = await request.json().catch(() => ({}));
  const resultat = normaliserGrilles(grilles);
  if (resultat.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 });

  const valeur = JSON.stringify(resultat.grilles);
  await prisma.parametre.upsert({ where: { cle: CLE_GRILLES }, update: { valeur }, create: { cle: CLE_GRILLES, valeur } });
  return NextResponse.json({ grilles: resultat.grilles });
}

// Rétablit les grilles d'origine (selon le type de véhicules du profil)
export async function DELETE() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  await prisma.parametre.deleteMany({ where: { cle: CLE_GRILLES } });
  return NextResponse.json({ grilles: grillesParDefaut(CLIENT.typeVehicules) });
}
