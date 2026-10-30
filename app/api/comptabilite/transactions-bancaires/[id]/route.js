import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import {
  associer, payerDepense, payerFacture, ajouterDepense, ajouterEcriture, transferer, appliquerRegle, exclure, annulerExamen, erreurPourReponse,
} from "@/lib/transactionsBancaires";

// Examen d'une transaction bancaire — voir lib/transactionsBancaires.js
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const corps = await request.json();
  try {
    switch (corps.action) {
      case "associer": await associer(params.id, corps.ligneIds, session.nom); break;
      case "payer-depense": await payerDepense(params.id, corps.depenseId, session.nom); break;
      case "payer-facture": await payerFacture(params.id, corps.factureId, session.nom); break;
      case "depense": await ajouterDepense(params.id, corps, session.nom); break;
      case "ecriture": await ajouterEcriture(params.id, corps, session.nom); break;
      case "transfert": await transferer(params.id, corps.compteTresorerieId, session.nom); break;
      case "regle": await appliquerRegle(params.id, corps.regleId, session.nom); break;
      case "exclure": await exclure(params.id, session.nom); break;
      case "annuler": await annulerExamen(params.id, session.nom); break;
      default: return NextResponse.json({ erreur: "Action inconnue." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}
