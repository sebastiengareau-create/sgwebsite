import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumeroCompte } from "@/lib/comptabilite";

const TYPES_VALIDES = ["ACTIF", "PASSIF", "CAPITAUX_PROPRES", "REVENU", "DEPENSE"];

// Suggère le prochain numéro disponible pour un type de compte (pré-remplissage
// du formulaire "+ Compte" du plan comptable — le numéro reste modifiable
// avant sauvegarde, contrairement aux numéros EMP-/CLI-/FOUR-)
export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const type = new URL(request.url).searchParams.get("type");
  if (!TYPES_VALIDES.includes(type)) {
    return NextResponse.json({ erreur: "Type invalide." }, { status: 400 });
  }

  const numero = await prochainNumeroCompte(type);
  return NextResponse.json({ numero });
}
