import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { ajouterPhoto } from "@/lib/etatsLieux";

// Photo d'un élément : { element (clé), dataUrl } → { id, element }
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const { element, dataUrl } = await request.json().catch(() => ({}));
  const r = await ajouterPhoto(id, element, dataUrl);
  if (r.erreur) return erreur(r.erreur, r.status || 400);
  return NextResponse.json(r);
}
