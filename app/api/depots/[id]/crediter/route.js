import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { transfererExcedentDepot } from "@/lib/creditClient";
import { erreurPourReponse } from "@/lib/transactionsBancaires";

// Passe l'excédent d'un dépôt (plus grand que sa facture) au crédit du
// client, au lieu de le rembourser — voir lib/creditClient.js
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  try {
    const { avertissementComptable } = await transfererExcedentDepot(params.id, { creePar: session.nom });
    return NextResponse.json({ ok: true, avertissementComptable });
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
