import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLE_PRIX_SAISON, refusPneus } from "@/lib/pneus";

// Prix de l'entreposage d'un jeu pour une saison : { prixSaison } (vide :
// aucune ligne ajoutée au bon). Réservé à l'accès « Paramètres ».
export async function PUT(request) {
  const session = await obtenirSession();
  const refus = await refusPneus(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  if (!(await aAccesSection(session, "parametres"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { prixSaison } = await request.json().catch(() => ({}));
  const texte = String(prixSaison ?? "").replace(/\s/g, "").replace(",", ".");
  const prix = texte === "" ? null : Number(texte);
  if (prix !== null && !(Number.isFinite(prix) && prix >= 0 && prix <= 10000)) return NextResponse.json({ erreur: "Prix invalide." }, { status: 400 });
  const valeur = prix === null ? "" : String(Math.round(prix * 100) / 100);
  await prisma.parametre.upsert({ where: { cle: CLE_PRIX_SAISON }, update: { valeur }, create: { cle: CLE_PRIX_SAISON, valeur } });
  return NextResponse.json({ prixSaison: prix === null ? null : Number(valeur) });
}
