import { NextResponse } from "next/server";
import { repondre, origineRequete } from "@/lib/signatureImmo";

// Réponse du signataire (page publique /signature/<jeton>) : protégée par le
// lien secret, sans compte. Une seule réponse par demande.
export async function POST(request, props) {
  const { jeton } = await props.params;
  const corps = await request.json().catch(() => ({}));
  const r = await repondre(jeton, corps, origineRequete(request));
  if (r.erreur) return NextResponse.json({ erreur: r.erreur }, { status: r.status || 400 });
  return NextResponse.json({ ok: true });
}
