import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { marquerFait } from "@/lib/entretienImmo";

// « Fait le … » : { date, coutReel, entrepreneur, numeroFacture, notes } —
// inscrit l'intervention comme réparation terminée et avance la prochaine date
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const r = await marquerFait(id, await request.json().catch(() => ({})), session.nom);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, ...r });
}
