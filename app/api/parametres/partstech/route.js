import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLE_UTILISATEUR, CLE_CLE, lireConfig } from "@/lib/partstech";
import { CLIENT } from "@/lib/client";

// Compte PartsTech du garage (Paramètres → PartsTech). La clé n'est jamais
// renvoyée au navigateur ; une clé vide garde celle déjà enregistrée.
export async function PUT(request) {
  if (!CLIENT.partstech) return NextResponse.json({ erreur: "PartsTech n'est pas offert dans cette installation." }, { status: 404 });
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const corps = await request.json().catch(() => ({}));
  const utilisateur = String(corps.utilisateur || "").trim().slice(0, 100);
  const cle = String(corps.cle || "").trim().slice(0, 200);

  if (corps.effacer) {
    await prisma.parametre.deleteMany({ where: { cle: { in: [CLE_UTILISATEUR, CLE_CLE] } } });
    return NextResponse.json(await lireConfig());
  }
  if (!utilisateur) return NextResponse.json({ erreur: "Indique l'utilisateur PartsTech." }, { status: 400 });
  await prisma.parametre.upsert({ where: { cle: CLE_UTILISATEUR }, update: { valeur: utilisateur }, create: { cle: CLE_UTILISATEUR, valeur: utilisateur } });
  if (cle) await prisma.parametre.upsert({ where: { cle: CLE_CLE }, update: { valeur: cle }, create: { cle: CLE_CLE, valeur: cle } });
  const config = await lireConfig();
  if (!config.cleEnregistree) return NextResponse.json({ erreur: "Indique la clé API PartsTech." }, { status: 400 });
  return NextResponse.json(config);
}
