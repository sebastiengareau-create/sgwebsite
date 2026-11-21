import { twilioConfigure, signatureTwilioValide, adressesAvis, majStatutTexto } from "@/lib/textosAuto";

// État d'un texto envoyé (livré, échoué…) : Twilio appelle cette adresse,
// donnée à chaque envoi (StatusCallback). Signé avec TWILIO_AUTH_TOKEN.
export async function POST(request) {
  if (!twilioConfigure()) return new Response(null, { status: 404 });
  const parametres = Object.fromEntries(new URLSearchParams(await request.text()));
  const signature = request.headers.get("x-twilio-signature");
  if (!adressesAvis(request).some((url) => signatureTwilioValide(url, parametres, signature))) {
    return new Response("Signature invalide.", { status: 403 });
  }
  try {
    await majStatutTexto(parametres);
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error("État de texto non traité :", e);
    return new Response("Erreur passagère.", { status: 500 });
  }
}
