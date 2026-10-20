import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { trouverBonsNonFactures } from "@/lib/bons";

// Bons pas encore facturés du client et de ses dossiers semblables — pour
// avertir dès qu'on le choisit au nouveau bon (profil avertirBonNonFacture)
export async function GET(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  return NextResponse.json(await trouverBonsNonFactures({ clientId: params.id }));
}
