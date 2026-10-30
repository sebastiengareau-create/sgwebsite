import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { associer, payerDepense, payerFacture, appliquerRegle } from "@/lib/transactionsBancaires";

// Accepte d'un coup les suggestions choisies à l'écran (correspondances
// trouvées, ou classements appris). Chacune est revalidée (montant, compte,
// ligne encore libre) ; celles qui échouent restent à examiner.
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { suggestions } = await request.json();
  let acceptees = 0;
  const erreurs = [];
  for (const s of Array.isArray(suggestions) ? suggestions : []) {
    try {
      if (s.type === "LIGNE") await associer(s.transactionId, [s.ligneId], session.nom);
      else if (s.type === "DEPENSE") await payerDepense(s.transactionId, s.depenseId, session.nom);
      else if (s.type === "FACTURE") await payerFacture(s.transactionId, s.factureId, session.nom);
      else if (s.type === "REGLE") await appliquerRegle(s.transactionId, s.regleId, session.nom);
      else continue;
      acceptees++;
    } catch (e) {
      erreurs.push(e.message.replace("PERIODE_LOCK:", "").split("\n")[0]);
    }
  }
  return NextResponse.json({ acceptees, erreurs });
}
