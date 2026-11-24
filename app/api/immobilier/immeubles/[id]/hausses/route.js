import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { appliquerHausses } from "@/lib/immobilierHausses";

// Inscrit aux baux choisis le nouveau loyer calculé selon la méthode du TAL
// (lib/immobilierHausses.js). Corps : { bailIds, annee, taux, taxes,
// assurances, travaux, pdf } — le calcul est refait ici ; pdf : range aussi
// le détail du calcul dans les documents de chaque bail.
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const body = await request.json().catch(() => ({}));
  const r = await appliquerHausses(id, body, session.nom);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, ...r });
}
