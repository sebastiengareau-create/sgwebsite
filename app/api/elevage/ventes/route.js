import { NextResponse } from "next/server";
import { sessionElevage, vendrePaquets } from "@/lib/elevage";
import { refusPeriodeElevage, livresElevage } from "@/lib/elevageCompta";

// Vente de paquets d'une coupe, en boutique ou en ligne (lib/elevage.js)
export async function POST(request) {
  const session = await sessionElevage();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const body = await request.json();
  // Élevage relié à la comptabilité : la vente va au compte de banque choisi
  if (/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")) {
    const refus = await refusPeriodeElevage({ nouvelles: [new Date(`${body.date}T12:00:00Z`)] });
    if (refus) return refus;
  }
  const resultat = await vendrePaquets(body, session.nom);
  if (resultat.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 });
  return NextResponse.json({ ok: true, nbLots: resultat.ventes.length, ...(await livresElevage(session)) });
}
