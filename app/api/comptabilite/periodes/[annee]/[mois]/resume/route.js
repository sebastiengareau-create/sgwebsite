import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { limitesMoisQuebec } from "@/lib/temps";
import { calculerResumeFermeture } from "@/lib/rapportsComptables";

export async function GET(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const annee = Number(params.annee);
  const mois = Number(params.mois);
  const { debut, fin } = limitesMoisQuebec(annee, mois);
  const resume = await calculerResumeFermeture({ debut, fin });

  return NextResponse.json(resume);
}
