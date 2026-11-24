import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { rouvrirEtatLieux } from "@/lib/etatsLieux";

// Rouvre un état des lieux terminé pour le corriger (son PDF est retiré),
// tant qu'aucune signature n'a été demandée
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const r = await rouvrirEtatLieux(id);
  if (r.erreur) return erreur(r.erreur, 409);
  return NextResponse.json({ ok: true });
}
