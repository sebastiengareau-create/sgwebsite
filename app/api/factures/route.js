import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { facturesDuMois, rechercherFactures } from "@/lib/listeFactures";

// Liste des factures : contenu d'un dossier de mois passé (?mois=YYYY-MM),
// ou recherche dans tout l'historique (?recherche=…)
export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const mois = searchParams.get("mois");
  const recherche = searchParams.get("recherche")?.trim();
  if (mois) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) return NextResponse.json({ erreur: "Mois invalide." }, { status: 400 });
    return NextResponse.json({ factures: await facturesDuMois(mois) });
  }
  if (recherche) return NextResponse.json(await rechercherFactures(recherche));
  return NextResponse.json({ erreur: "Préciser un mois ou une recherche." }, { status: 400 });
}
