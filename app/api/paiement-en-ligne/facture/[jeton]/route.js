import { NextResponse } from "next/server";
import { payerFacture } from "@/lib/paiementEnLigne";

// Ouvre la page de paiement Stripe pour le solde d'une facture (page /payer/<jeton>).
// Publique, protégée par le lien secret → { url }
export async function POST(request, props) {
  const { jeton } = await props.params;
  try {
    return NextResponse.json({ url: await payerFacture(jeton) });
  } catch (e) {
    return NextResponse.json({ erreur: e.message || "Le paiement n'a pas pu être ouvert." }, { status: 400 });
  }
}
