import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { envoyerRappelsPneus, refusPneus } from "@/lib/pneus";

// Rappels de changement de saison :
//  - { mode: "courriel", jeuIds } : envoie le courriel (un par client) ;
//  - { mode: "texto", jeuId } : le texto part du téléphone (lien « sms: ») ;
//    on note seulement qu'il a été rappelé.
export async function POST(request) {
  const session = await obtenirSession();
  const refus = await refusPneus(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { mode, jeuIds, jeuId } = await request.json().catch(() => ({}));
  if (mode === "texto") {
    const { count } = await prisma.jeuPneus.updateMany({ where: { id: String(jeuId || "") }, data: { rappelLe: new Date() } });
    if (!count) return NextResponse.json({ erreur: "Jeu de pneus introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  if (mode !== "courriel" || !Array.isArray(jeuIds) || !jeuIds.length) return NextResponse.json({ erreur: "Rien à envoyer." }, { status: 400 });
  const resultat = await envoyerRappelsPneus(jeuIds.map(String).slice(0, 500));
  if (resultat.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: 500 });
  return NextResponse.json(resultat);
}
