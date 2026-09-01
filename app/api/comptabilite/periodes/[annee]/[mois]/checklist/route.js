import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirChecklist } from "@/lib/checklistFermeture";

export async function GET(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const checklist = await obtenirChecklist(Number(params.annee), Number(params.mois));
  return NextResponse.json(checklist);
}
