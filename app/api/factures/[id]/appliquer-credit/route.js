import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { appliquerCredit } from "@/lib/creditClient";
import { erreurPourReponse } from "@/lib/transactionsBancaires";

// Applique le crédit du client sur la facture, jusqu'au solde — voir
// lib/creditClient.js. Corps (optionnel) : { montant } pour en appliquer moins.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { montant = null } = await request.json().catch(() => ({}));
  try {
    const { facture, avertissementComptable } = await appliquerCredit(params.id, { montant, creePar: session.nom });
    return NextResponse.json({ ...facture, avertissementComptable });
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
