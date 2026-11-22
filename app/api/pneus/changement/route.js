import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { changementDeSaison, refusPneus } from "@/lib/pneus";

// Changement de saison sur un bon (carte « Pneus entreposés ») :
// { bonId, sortirId?, entrerId?, nouveau?, emplacement?, usure?, tache, facturer }
// Ajoute des tâches au bon : il faut aussi l'accès « Opérations ».
export async function POST(request) {
  const session = await obtenirSession();
  const refus = await refusPneus(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  if (!(await aAccesSection(session, "operations"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const corps = await request.json().catch(() => ({}));
  const resultat = await changementDeSaison({ ...corps, tache: !!corps.tache, facturer: !!corps.facturer, session });
  if (resultat.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: resultat.status || 400 });
  return NextResponse.json(resultat);
}
