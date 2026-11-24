import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { majEtatLieux, supprimerEtatLieux } from "@/lib/etatsLieux";

// Enregistre ce qui a été rempli : { pieces, compteurs, notes, date }
export async function PATCH(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const r = await majEtatLieux(id, await request.json().catch(() => ({})));
  if (r.erreur) return erreur(r.erreur, r.status || 400);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const r = await supprimerEtatLieux(id);
  if (r.erreur) return erreur(r.erreur, 409);
  return NextResponse.json({ ok: true, bailId: r.bailId || null });
}
