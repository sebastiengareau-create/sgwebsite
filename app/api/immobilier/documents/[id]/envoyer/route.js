import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { envoyerDocument } from "@/lib/immobilierCourriel";

// Envoie le document par courriel aux locataires de son bail (PDF joint)
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const r = await envoyerDocument(id, session.nom);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, ...r }, { status: r.envoyes ? 200 : 502 });
}
