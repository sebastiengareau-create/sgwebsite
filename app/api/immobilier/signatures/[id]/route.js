import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { envoyerDemandes, annulerDemande } from "@/lib/signatureImmo";

// Relance par courriel une demande de signature en attente
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const r = await envoyerDemandes([id], session.nom, { relance: true });
  if (r.erreur) return erreur(r.erreur);
  if (!r.envoyes && r.sansCourriel?.length) return erreur("Ce signataire n'a pas de courriel : transmets-lui le lien toi-même.");
  return NextResponse.json({ ok: true, ...r }, { status: r.envoyes ? 200 : 502 });
}

// Annule une demande de signature en attente
export async function DELETE(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const r = await annulerDemande(id);
  if (r.erreur) return erreur(r.erreur, 409);
  return NextResponse.json({ ok: true });
}
