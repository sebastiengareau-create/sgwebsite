import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { enregistrerReglagesImmoAuto, verifierAutomatisationsImmo } from "@/lib/immobilierAuto";

// Réglages des automatisations de l'immobilier (lib/immobilierAuto.js) :
// { loyersAuto, rappelRetard, joursRappel, avisProprio } — ou { verifier: true }
// pour faire tout de suite la vérification du jour
export async function POST(req) {
  const session = await sessionImmo();
  if (!session) return refus();
  const body = await req.json().catch(() => ({}));
  if (body.verifier === true) {
    const resultat = await verifierAutomatisationsImmo({ forcer: true });
    return NextResponse.json({ ok: true, resultat });
  }
  const r = await enregistrerReglagesImmoAuto(body);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, reglages: r.reglages });
}
