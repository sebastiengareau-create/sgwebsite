import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { lireCle, detailler } from "@/lib/googlePlaces";

// Adresse choisie dans les suggestions → { adresse, ville, province, codePostal }
export async function GET(request) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const cle = await lireCle();
  if (!cle) return NextResponse.json({ erreur: "Google Places n'est pas configuré." }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const id = String(searchParams.get("id") || "").slice(0, 300);
  const jeton = String(searchParams.get("jeton") || "").slice(0, 100);
  if (!id) return NextResponse.json({ erreur: "Adresse manquante." }, { status: 400 });
  try {
    return NextResponse.json(await detailler(cle, id, jeton));
  } catch (e) {
    return NextResponse.json({ erreur: e.message }, { status: 502 });
  }
}
