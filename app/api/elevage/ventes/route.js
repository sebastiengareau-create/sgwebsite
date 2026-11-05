import { NextResponse } from "next/server";
import { sessionElevage, vendrePaquets } from "@/lib/elevage";

// Vente de paquets d'une coupe, en boutique ou en ligne (lib/elevage.js)
export async function POST(request) {
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const resultat = await vendrePaquets(await request.json(), session.nom);
  if (resultat.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 });
  return NextResponse.json({ ok: true, nbLots: resultat.ventes.length });
}
