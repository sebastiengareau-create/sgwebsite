import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { creerJeu, refusPneus } from "@/lib/pneus";

// Nouveau jeu de pneus : { clientId, vehiculeId, statut ("ENTREPOSE" |
// "POSE"), saison, marque, modele, dimension, quantite, jantes,
// anneeFabrication, usure, emplacement, note } → le jeu
export async function POST(request) {
  const session = await obtenirSession();
  const refus = await refusPneus(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const corps = await request.json().catch(() => ({}));
  const jeu = await creerJeu({ clientId: corps.clientId, vehiculeId: corps.vehiculeId || null, brut: corps, statut: corps.statut, bonId: corps.bonId || null, session });
  if (jeu.erreur) return NextResponse.json({ erreur: jeu.erreur }, { status: 400 });
  return NextResponse.json(jeu);
}
