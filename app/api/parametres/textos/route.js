import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLE_REGLAGES_TEXTOS, normaliserReglages } from "@/lib/textosAuto";

// Textos automatiques : ce qui part tout seul
// { envoiDirect, vehiculePret, rappelRdv, heureRappel, reponses }
export async function PUT(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const corps = await request.json().catch(() => null);
  if (!corps || typeof corps !== "object") return NextResponse.json({ erreur: "Réglages illisibles." }, { status: 400 });
  const reglages = normaliserReglages(corps);
  const valeur = JSON.stringify(reglages);
  await prisma.parametre.upsert({ where: { cle: CLE_REGLAGES_TEXTOS }, update: { valeur }, create: { cle: CLE_REGLAGES_TEXTOS, valeur } });
  return NextResponse.json({ reglages });
}
