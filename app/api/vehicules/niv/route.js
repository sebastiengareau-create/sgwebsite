import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { decoderNiv } from "@/lib/catalogueVehicules";

// Décode un NIV pour préremplir le dossier véhicule (voir decoderNiv) :
//
//   GET /api/vehicules/niv?niv=2HGFC2F59KH000000
//   → { niv, avertissement?, annee, marque, modele, version, source: "NHTSA" | "local" }
export async function GET(request) {
  const cleRecue = request.headers.get("x-webhook-secret");
  const cleAttendue = process.env.GARAGE_BOOKING_WEBHOOK_SECRET;
  const parCle = !!cleAttendue && cleRecue === cleAttendue;
  if (!parCle && !(await obtenirSession())) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  const resultat = await decoderNiv(new URL(request.url).searchParams.get("niv"));
  if (resultat.erreur) return NextResponse.json(resultat, { status: 400 });
  return NextResponse.json(resultat);
}
