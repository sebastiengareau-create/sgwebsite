import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { CLE_DEPOT_POURCENT } from "@/lib/paiementEnLigne";

// Dépôt demandé en ligne à l'approbation d'une soumission ou des travaux
// d'une inspection : { pourcentDepot } (1 à 100 ; vide : pas de dépôt)
export async function PUT(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { pourcentDepot } = await request.json().catch(() => ({}));
  const texte = String(pourcentDepot ?? "").replace(/[\s%]/g, "").replace(",", ".");
  const n = texte === "" ? null : Number(texte);
  if (n !== null && !(Number.isFinite(n) && n > 0 && n <= 100)) return NextResponse.json({ erreur: "Le dépôt est un pourcentage de 1 à 100 (ou vide)." }, { status: 400 });
  const valeur = n === null ? "" : String(n);
  await prisma.parametre.upsert({ where: { cle: CLE_DEPOT_POURCENT }, update: { valeur }, create: { cle: CLE_DEPOT_POURCENT, valeur } });
  return NextResponse.json({ pourcentDepot: n });
}
