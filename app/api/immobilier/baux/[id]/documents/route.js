import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur, genererDocumentBail } from "@/lib/immobilier";

// Génère un document (avis, rappel, état des lieux, fiche de bail…) à partir
// du bail et le range dans ses documents. Corps : { type, ...valeurs }
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const body = await request.json().catch(() => ({}));
  const r = await genererDocumentBail(id, body.type, body, session.nom);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, id: r.id });
}
