import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { rembourserCredit } from "@/lib/creditClient";
import { erreurPourReponse } from "@/lib/transactionsBancaires";

// Rembourse au client tout ou partie de son crédit — voir lib/creditClient.js
// — corps : { montant, modePaiement, compteTresorerieId, reference }
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const corps = await request.json().catch(() => ({}));
  try {
    const { avertissementComptable } = await rembourserCredit(params.id, corps, { creePar: session.nom });
    return NextResponse.json({ ok: true, avertissementComptable });
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
