import { NextResponse } from "next/server";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { accorderGesteCommercial } from "@/lib/creditClient";
import { erreurPourReponse } from "@/lib/transactionsBancaires";

// Geste commercial : crédit accordé au client sans paiement — voir
// lib/creditClient.js. Gérant seulement. Corps : { montant, note }
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Seul le gérant peut accorder un geste commercial." }, { status: 403 });
  }
  const corps = await request.json().catch(() => ({}));
  try {
    const { avertissementComptable } = await accorderGesteCommercial(params.id, corps, { creePar: session.nom });
    return NextResponse.json({ ok: true, avertissementComptable });
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
