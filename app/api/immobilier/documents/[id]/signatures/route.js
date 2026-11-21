import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { demanderSignatures } from "@/lib/signatureImmo";

// Demande la signature électronique d'un document PDF (lib/signatureImmo.js).
// Corps : { locataireIds, locateur, envoyer, message }
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const body = await request.json().catch(() => ({}));
  const r = await demanderSignatures(id, {
    locataireIds: body.locataireIds, locateur: Boolean(body.locateur), envoyer: body.envoyer !== false, message: body.message, creePar: session.nom,
  });
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, ...r });
}
