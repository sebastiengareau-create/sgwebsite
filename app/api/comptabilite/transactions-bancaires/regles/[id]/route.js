import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { oublierRegle } from "@/lib/transactionsBancaires";

// Oublie un classement appris (il se réapprendra au prochain ajout semblable)
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  await oublierRegle(params.id);
  return NextResponse.json({ ok: true });
}
