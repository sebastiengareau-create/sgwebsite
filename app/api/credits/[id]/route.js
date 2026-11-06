import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { retirerMouvementCredit } from "@/lib/creditClient";
import { erreurPourReponse } from "@/lib/transactionsBancaires";

// Retire un mouvement de crédit client entré par erreur, avec son écriture
// — voir lib/creditClient.js
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  try {
    await retirerMouvementCredit(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
