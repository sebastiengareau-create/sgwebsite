import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { lireCle, suggerer } from "@/lib/googlePlaces";

// « Tester » : une recherche d'adresse, pour confirmer que la clé est valide
// et que « Places API (New) » est activée dans le projet Google.
export async function POST() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const cle = await lireCle();
  if (!cle) return NextResponse.json({ erreur: "Aucune clé enregistrée." }, { status: 400 });
  try {
    const suggestions = await suggerer(cle, "1000 rue Sherbrooke Ouest, Montréal");
    return NextResponse.json({ ok: true, exemple: suggestions[0] ? `${suggestions[0].principal}, ${suggestions[0].secondaire}` : null });
  } catch (e) {
    return NextResponse.json({ erreur: e.message }, { status: 502 });
  }
}
