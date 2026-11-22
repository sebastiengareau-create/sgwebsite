import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { assurerLienPaiement, paiementEnLigneActif } from "@/lib/paiementEnLigne";

// Lien de paiement en ligne d'une facture (créé au besoin), pour l'envoyer
// au client par texto ou le copier
export async function POST(request, props) {
  const { id } = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if (!(await paiementEnLigneActif())) return NextResponse.json({ erreur: "Le paiement en ligne n'est pas activé." }, { status: 409 });
  const lien = await assurerLienPaiement(id);
  if (!lien) return NextResponse.json({ erreur: "Facture introuvable." }, { status: 404 });
  return NextResponse.json({ lien });
}
