import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur, genererDocumentBail } from "@/lib/immobilier";
import { envoyerDocument } from "@/lib/immobilierCourriel";

// Génère un document (avis, rappel, état des lieux, fiche de bail…) à partir
// du bail et le range dans ses documents. Corps : { type, ...valeurs,
// envoyer } — envoyer : aussi par courriel aux locataires (PDF joint).
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const body = await request.json().catch(() => ({}));
  const r = await genererDocumentBail(id, body.type, body, session.nom);
  if (r.erreur) return erreur(r.erreur);
  const envoi = body.envoyer ? await envoyerDocument(r.id, session.nom) : null;
  return NextResponse.json({ ok: true, id: r.id, envoi });
}
