import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { creerEtatLieux } from "@/lib/etatsLieux";

// Commence un état des lieux du bail : { moment: "ENTREE" | "SORTIE" } → { id }
// (celui déjà en cours pour ce moment, s'il y en a un)
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const body = await request.json().catch(() => ({}));
  const r = await creerEtatLieux(id, body.moment, session.nom);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, id: r.id });
}
