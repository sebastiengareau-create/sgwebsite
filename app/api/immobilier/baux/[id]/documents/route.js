import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur, genererDocumentBail } from "@/lib/immobilier";
import { envoyerDocument } from "@/lib/immobilierCourriel";
import { demanderSignatures } from "@/lib/signatureImmo";
import { prisma } from "@/lib/prisma";

// Génère un document (avis, rappel, état des lieux, fiche de bail…) à partir
// du bail et le range dans ses documents. Corps : { type, ...valeurs,
// envoyer, faireSigner } — envoyer : aussi par courriel aux locataires (PDF
// joint) ; faireSigner : demande la signature en ligne à tous les locataires
// du bail (et au locateur pour le bail de logement), lien envoyé par courriel.
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const body = await request.json().catch(() => ({}));
  const r = await genererDocumentBail(id, body.type, body, session.nom);
  if (r.erreur) return erreur(r.erreur);
  if (body.faireSigner) {
    const locataires = await prisma.locataireImmo.findMany({ where: { baux: { some: { id } } }, select: { id: true } });
    const s = await demanderSignatures(r.id, { locataireIds: locataires.map((l) => l.id), locateur: body.type === "BAIL_LOGEMENT" || body.type === "BAIL_FORMULAIRE", envoyer: true, creePar: session.nom });
    return NextResponse.json({ ok: true, id: r.id, signature: s });
  }
  const envoi = body.envoyer ? await envoyerDocument(r.id, session.nom) : null;
  return NextResponse.json({ ok: true, id: r.id, envoi });
}
