import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { annulerImport } from "@/lib/transactionsBancaires";

// Annule un import : retire ses transactions encore à examiner
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const retirees = await annulerImport(params.id);
  return NextResponse.json({ retirees });
}
