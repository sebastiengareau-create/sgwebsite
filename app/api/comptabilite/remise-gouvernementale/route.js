import { NextResponse } from "next/server";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterRemiseGouvernementale } from "@/lib/comptabilite";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { paiements, description, reference } = await request.json(); // [{ compteNumero, montant, description }]
  if (!Array.isArray(paiements) || paiements.length === 0) {
    return NextResponse.json({ erreur: "Aucun paiement fourni." }, { status: 400 });
  }

  const descriptionFinale = (description || "Remise gouvernementale") + (reference ? ` (réf. ${reference})` : "");

  try {
    const total = await posterRemiseGouvernementale(paiements, descriptionFinale, session.nom);
    return NextResponse.json({ ok: true, total });
  } catch (e) {
    return NextResponse.json({ erreur: e.message }, { status: 400 });
  }
}
