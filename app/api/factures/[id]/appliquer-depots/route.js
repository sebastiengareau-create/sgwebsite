import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { appliquerDepots } from "@/lib/depots";
import { erreurPourReponse } from "@/lib/transactionsBancaires";

// Applique à la facture les dépôts de son bon pas encore appliqués (ex. un
// dépôt retiré de la facture par erreur) — voir lib/depots.js
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  try {
    const { facture, nombre, avertissementComptable } = await appliquerDepots(params.id, { creePar: session.nom });
    return NextResponse.json({ ...facture, nombre, avertissementComptable });
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
