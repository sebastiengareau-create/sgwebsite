import { NextResponse } from "next/server";
import { routesCollection } from "@/lib/coproprieteRoutes";
import { sessionCopro, refus, erreur, genererCotisations } from "@/lib/copropriete";

const collection = routesCollection("chargeCopro", "charge", {
  avant: (data, { session }) => { data.creePar = session.nom; },
});

// Une charge à une unité (cotisation spéciale, frais…) ou, avec
// { generer: "2026-11" }, les cotisations du mois de toutes les unités
// selon le budget et les quotes-parts
export async function POST(request) {
  const body = await request.clone().json().catch(() => ({}));
  if (!body.generer) return collection.POST(request);
  const session = await sessionCopro();
  if (!session) return refus();
  const r = await genererCotisations(body.generer, session.nom);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, creees: r.creees });
}
