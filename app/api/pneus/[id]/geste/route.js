import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { bougerJeu, refusPneus } from "@/lib/pneus";

// Geste sur un jeu : { action: "sortir" | "entreposer" | "remettre" |
// "deplacer", emplacement?, usure?, note? } → le jeu
export async function POST(request, props) {
  const { id } = await props.params;
  const session = await obtenirSession();
  const refus = await refusPneus(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { action, emplacement, usure, note } = await request.json().catch(() => ({}));
  const jeu = await bougerJeu(id, action, { emplacement, usure, note, session });
  if (jeu.erreur) return NextResponse.json({ erreur: jeu.erreur }, { status: jeu.status || 400 });
  return NextResponse.json(jeu);
}
