import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLE, lireConfig } from "@/lib/googlePlaces";

// Clé Google Places de l'installation (Paramètres → Google Places). Elle
// n'est jamais renvoyée au navigateur.
export async function PUT(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const corps = await request.json().catch(() => ({}));
  if (corps.effacer) {
    await prisma.parametre.deleteMany({ where: { cle: CLE } });
    return NextResponse.json(await lireConfig());
  }
  const cle = String(corps.cle || "").trim().slice(0, 200);
  if (!cle) return NextResponse.json({ erreur: "Indique la clé API Google." }, { status: 400 });
  await prisma.parametre.upsert({ where: { cle: CLE }, update: { valeur: cle }, create: { cle: CLE, valeur: cle } });
  return NextResponse.json(await lireConfig());
}
