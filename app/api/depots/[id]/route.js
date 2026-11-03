import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { retirerDepot } from "@/lib/depots";
import { erreurPourReponse } from "@/lib/transactionsBancaires";

// Retire un dépôt entré par erreur ou remboursé : son écriture est supprimée
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  try {
    await retirerDepot(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
