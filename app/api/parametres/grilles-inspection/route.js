import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLIENT } from "@/lib/client";
import { CLE_GRILLES, CLE_SEUILS } from "@/lib/inspections";
import { grillesParDefaut, normaliserGrilles, normaliserSeuils } from "@/lib/grillesInspection";

const enregistrer = (cle, valeur) => prisma.parametre.upsert({ where: { cle }, update: { valeur }, create: { cle, valeur } });

// Grilles d'inspection du garage (Paramètres → Grilles d'inspection) et
// seuils des états proposés selon la mesure : { grilles?, seuils? }, chacun
// enregistré seulement s'il est reçu. Les grilles servent aux prochaines
// inspections ; celles déjà faites gardent leurs points.
export async function PUT(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { grilles, seuils } = await request.json().catch(() => ({}));
  if (grilles === undefined && seuils === undefined) return NextResponse.json({ erreur: "Rien à enregistrer." }, { status: 400 });
  const resultat = grilles === undefined ? null : normaliserGrilles(grilles);
  if (resultat?.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 });
  const resultatSeuils = seuils === undefined ? null : normaliserSeuils(seuils);
  if (resultatSeuils?.erreur) return NextResponse.json({ erreur: resultatSeuils.erreur }, { status: 400 });

  if (resultat) await enregistrer(CLE_GRILLES, JSON.stringify(resultat.grilles));
  if (resultatSeuils) await enregistrer(CLE_SEUILS, JSON.stringify(resultatSeuils.seuils));
  return NextResponse.json({ ...(resultat && { grilles: resultat.grilles }), ...(resultatSeuils && { seuils: resultatSeuils.seuils }) });
}

// Rétablit les grilles d'origine (selon le type de véhicules du profil) ;
// les seuils ne changent pas
export async function DELETE() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  await prisma.parametre.deleteMany({ where: { cle: CLE_GRILLES } });
  return NextResponse.json({ grilles: grillesParDefaut(CLIENT.typeVehicules) });
}
