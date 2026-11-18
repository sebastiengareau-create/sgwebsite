import { NextResponse } from "next/server";
import { routesCollection } from "@/lib/immobilierRoutes";
import { sessionImmo, refus, erreur, genererLoyers } from "@/lib/immobilier";

const collection = routesCollection("chargeImmo", "charge", {
  avant: (data, { session }) => { data.creePar = session.nom; },
});

// Une charge sur un bail (frais, ajustement…) ou, avec { generer: "2026-11" },
// le loyer du mois de tous les baux en cours
export async function POST(request) {
  const body = await request.clone().json().catch(() => ({}));
  if (!body.generer) return collection.POST(request);
  const session = await sessionImmo();
  if (!session) return refus();
  const r = await genererLoyers(body.generer, session.nom);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, creees: r.creees });
}
