import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { CLES_SMS, lireConfigSms, envoyerSms, normaliserTelephone } from "@/lib/sms";
import { obtenirInfosEntreprise } from "@/lib/config";

async function estVraimentSuperAdmin(session) {
  if (!session?.id) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

// Enregistre la configuration Twilio. Jeton laissé vide = on garde celui
// déjà enregistré (il n'est jamais renvoyé au navigateur).
export async function PATCH(request) {
  const session = await obtenirSession();
  if (!(await estVraimentSuperAdmin(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const corps = await request.json().catch(() => ({}));
  const accountSid = String(corps.accountSid || "").trim();
  const authToken = String(corps.authToken || "").trim();
  const numero = String(corps.numero || "").trim();
  const adressePublique = String(corps.adressePublique || "").trim().replace(/\/+$/, "");

  if (accountSid && !/^AC[0-9a-fA-F]{32}$/.test(accountSid)) {
    return NextResponse.json({ erreur: "L'Account SID commence par « AC » suivi de 32 caractères." }, { status: 400 });
  }
  if (numero && !normaliserTelephone(numero)) {
    return NextResponse.json({ erreur: "Numéro Twilio illisible — format attendu : +15145550123." }, { status: 400 });
  }
  if (adressePublique && !/^https?:\/\/[^\s/]+/.test(adressePublique)) {
    return NextResponse.json({ erreur: "L'adresse publique doit commencer par https://" }, { status: 400 });
  }

  const valeurs = { accountSid, numero: numero && normaliserTelephone(numero), adressePublique };
  if (authToken) valeurs.authToken = authToken;
  for (const [champ, valeur] of Object.entries(valeurs)) {
    const cle = CLES_SMS[champ];
    await prisma.parametre.upsert({ where: { cle }, update: { valeur }, create: { cle, valeur } });
  }
  return NextResponse.json({ ok: true });
}

// SMS test vers un numéro, avec la configuration enregistrée
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await estVraimentSuperAdmin(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const { telephone } = await request.json().catch(() => ({}));
  const { nomEntreprise } = await obtenirInfosEntreprise();
  const config = await lireConfigSms();
  const resultat = await envoyerSms(telephone, `${nomEntreprise} : SMS test réussi. Les avis de tâches en déplacement fonctionnent.`, config);
  const messages = {
    ENVOYE: "SMS test envoyé ✓ — vérifie le téléphone.",
    SANS_TELEPHONE: resultat.erreur || "Entre un numéro de cellulaire.",
    NON_CONFIGURE: "Configuration incomplète : Account SID, jeton et numéro Twilio sont requis.",
    ECHEC: `Twilio a refusé l'envoi : ${resultat.erreur}`,
  };
  return NextResponse.json({ ok: resultat.statut === "ENVOYE", message: messages[resultat.statut] }, { status: resultat.statut === "ENVOYE" ? 200 : 400 });
}
