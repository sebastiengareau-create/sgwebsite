import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { lireCle, suggerer } from "@/lib/googlePlaces";

// Suggestions d'adresses complètes (Google Places) pendant la saisie d'un
// champ Adresse — { actif: false } sans clé : le champ cesse alors de demander.
export async function GET(request) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const cle = await lireCle();
  if (!cle) return NextResponse.json({ actif: false, suggestions: [] });

  const { searchParams } = new URL(request.url);
  const texte = String(searchParams.get("q") || "").trim().slice(0, 200);
  const jeton = String(searchParams.get("jeton") || "").slice(0, 100);
  if (texte.length < 3) return NextResponse.json({ actif: true, suggestions: [] });
  try {
    return NextResponse.json({ actif: true, suggestions: await suggerer(cle, texte, jeton) });
  } catch (e) {
    return NextResponse.json({ erreur: e.message }, { status: 502 });
  }
}
