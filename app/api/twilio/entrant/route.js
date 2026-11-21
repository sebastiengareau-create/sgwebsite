import { twilioConfigure, textosActifs, signatureTwilioValide, adressesAvis, recevoirTexto } from "@/lib/textosAuto";

// Texto reçu d'un client : Twilio appelle cette adresse (numéro d'envoi →
// Messaging → « A message comes in », <APP_URL>/api/twilio/entrant, POST).
// Signé avec TWILIO_AUTH_TOKEN : un avis non signé est refusé. La réponse
// est du TwiML : vide, ou un texto à renvoyer au client (ARRET, RETOUR…).
const echapper = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const twiml = (message) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${echapper(message)}</Message>` : ""}</Response>`, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });

export async function POST(request) {
  if (!twilioConfigure()) return new Response("Textos non configurés.", { status: 404 });
  const parametres = Object.fromEntries(new URLSearchParams(await request.text()));
  const signature = request.headers.get("x-twilio-signature");
  if (!adressesAvis(request).some((url) => signatureTwilioValide(url, parametres, signature))) {
    return new Response("Signature invalide.", { status: 403 });
  }
  if (!(await textosActifs())) return twiml(null);
  try {
    return twiml(await recevoirTexto(parametres));
  } catch (e) {
    console.error("Texto reçu non traité :", e);
    return new Response("Erreur passagère.", { status: 500 });
  }
}
