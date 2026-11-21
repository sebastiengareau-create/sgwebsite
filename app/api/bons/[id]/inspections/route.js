import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";
import { creerInspection, refusInspection } from "@/lib/inspections";

// Commence une inspection numérique sur le bon, avec la grille choisie
// (lib/grillesInspection.js) → { id }
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const { grille } = await request.json().catch(() => ({}));
  try {
    const inspection = await creerInspection({ bonId: params.id, cleGrille: grille, session });
    return NextResponse.json(inspection);
  } catch (e) {
    return NextResponse.json({ erreur: e.message }, { status: 400 });
  }
}
