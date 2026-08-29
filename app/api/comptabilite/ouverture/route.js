import { NextResponse } from "next/server";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { enregistrerSoldesOuverture } from "@/lib/comptabilite";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { soldes } = await request.json();
  if (!Array.isArray(soldes) || soldes.length === 0) {
    return NextResponse.json({ erreur: "Aucun solde fourni." }, { status: 400 });
  }

  try {
    await enregistrerSoldesOuverture(soldes);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erreur: e.message }, { status: 400 });
  }
}
