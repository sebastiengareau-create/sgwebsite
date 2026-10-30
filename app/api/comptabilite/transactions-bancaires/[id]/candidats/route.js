import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirCandidats, erreurPourReponse } from "@/lib/transactionsBancaires";

// Lignes du compte qui pourraient correspondre à la transaction (« Trouver »)
export async function GET(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  try {
    return NextResponse.json(await obtenirCandidats(params.id));
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
