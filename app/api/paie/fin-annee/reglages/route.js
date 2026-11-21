import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesPaieActif } from "@/lib/accesPaie";
import { CLE_CODE_DENTAIRE } from "@/lib/finAnnee";

// Code d'assurance dentaire par défaut des T4 (case 45) : { codeDentaireDefaut } (1 à 5)
export async function PUT(request) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { codeDentaireDefaut } = await request.json().catch(() => ({}));
  const code = Number(codeDentaireDefaut);
  if (!(Number.isInteger(code) && code >= 1 && code <= 5)) return NextResponse.json({ erreur: "Code invalide (1 à 5)." }, { status: 400 });
  await prisma.parametre.upsert({ where: { cle: CLE_CODE_DENTAIRE }, update: { valeur: String(code) }, create: { cle: CLE_CODE_DENTAIRE, valeur: String(code) } });
  return NextResponse.json({ codeDentaireDefaut: code });
}
