import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { inscrirePourcentage } from "@/lib/immobilierHausses";

// Pourcentage de base d'une période pas encore connue de l'appli (le TAL le
// publie vers la mi-janvier). Corps : { periode: 2027, taux: "2,8" } — taux
// vide : le retire.
export async function POST(request) {
  const session = await sessionImmo();
  if (!session) return refus();
  const body = await request.json().catch(() => ({}));
  const r = await inscrirePourcentage(body.periode, body.taux);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, inscrits: r.inscrits });
}
