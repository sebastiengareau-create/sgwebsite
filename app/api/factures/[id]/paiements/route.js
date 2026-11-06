import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { enregistrerPaiements } from "@/lib/paiementsFactures";
import { erreurPourReponse } from "@/lib/transactionsBancaires";

// Encaisse un ou plusieurs paiements sur la facture (voir lib/paiementsFactures.js)
// — corps : { paiements: [{ montant, modePaiement, compteTresorerieId, reference }], excedentEnCredit }
// excedentEnCredit : ce qui dépasse le solde est gardé en crédit client
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { paiements, excedentEnCredit = false } = await request.json();
  try {
    const { facture, avertissementComptable } = await enregistrerPaiements(params.id, paiements, { creePar: session.nom, excedentEnCredit: excedentEnCredit === true });
    return NextResponse.json({ ...facture, avertissementComptable });
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
