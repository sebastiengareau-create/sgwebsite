import { NextResponse } from "next/server";
import { signatureStripeValide, traiterAvisStripe } from "@/lib/paiementEnLigne";

// Avis de Stripe (à déclarer dans Stripe → Développeurs → Webhooks, adresse
// <APP_URL>/api/stripe/webhook, événements checkout.session.completed,
// checkout.session.async_payment_succeeded et checkout.session.expired).
// Signé avec STRIPE_WEBHOOK_SECRET : un avis non signé est refusé. Une
// erreur passagère renvoie 500 : Stripe réessaiera.
export async function POST(request) {
  const corps = await request.text();
  if (!signatureStripeValide(corps, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ erreur: "Signature invalide." }, { status: 400 });
  }
  let evenement;
  try {
    evenement = JSON.parse(corps);
  } catch {
    return NextResponse.json({ erreur: "Avis illisible." }, { status: 400 });
  }
  try {
    return NextResponse.json({ recu: true, ...(await traiterAvisStripe(evenement)) });
  } catch (e) {
    console.error("Avis Stripe non traité :", e);
    return NextResponse.json({ erreur: "Erreur passagère." }, { status: 500 });
  }
}
