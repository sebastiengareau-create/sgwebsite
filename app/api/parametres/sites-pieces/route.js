import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLE, validerSites } from "@/lib/recherchePieces";

// Sites des fournisseurs offerts dans « Rechercher des pièces » d'un bon
export async function PUT(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { sites } = await request.json().catch(() => ({}));
  const resultat = validerSites(sites);
  if (resultat.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 });

  const valeur = JSON.stringify(resultat.sites);
  await prisma.parametre.upsert({ where: { cle: CLE }, update: { valeur }, create: { cle: CLE, valeur } });
  return NextResponse.json({ sites: resultat.sites });
}
