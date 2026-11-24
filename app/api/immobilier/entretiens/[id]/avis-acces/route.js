import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { avisAccesEntretien } from "@/lib/entretienImmo";

// Avis d'accès de 24 h à chaque bail résidentiel en cours de l'immeuble :
// { dateAcces, heure, envoyer } → { generes, envoyes, sansCourriel }
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const r = await avisAccesEntretien(id, await request.json().catch(() => ({})), session.nom);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, ...r });
}
