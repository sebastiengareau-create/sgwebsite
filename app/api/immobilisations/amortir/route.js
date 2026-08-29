import { NextResponse } from "next/server";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterAmortissementMensuel } from "@/lib/comptabilite";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { mois } = await request.json(); // "YYYY-MM"
  if (!mois) return NextResponse.json({ erreur: "Mois requis." }, { status: 400 });

  try {
    const montant = await posterAmortissementMensuel(mois, session.nom);
    return NextResponse.json({ ok: true, montant });
  } catch (e) {
    return NextResponse.json({ erreur: e.message }, { status: 409 });
  }
}
