import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { enregistrerDepots } from "@/lib/depots";
import { erreurPourReponse } from "@/lib/transactionsBancaires";

// Encaisse un dépôt sur une soumission ou un bon (voir lib/depots.js)
// — corps : { soumissionId | bonId, paiements: [{ montant, modePaiement, compteTresorerieId, reference }] }
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { soumissionId, bonId, paiements } = await request.json();
  try {
    const { avertissementComptable } = await enregistrerDepots({ soumissionId, bonId }, paiements, { creePar: session.nom });
    return NextResponse.json({ ok: true, avertissementComptable });
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
