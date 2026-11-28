import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";

async function estVraimentSuperAdmin(session) {
  if (!session?.id) return false;
  if (session.role === "DEVELOPPEUR") return true;
  const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
  return utilisateur?.estSuperAdmin || false;
}

export async function PATCH(request) {
  const session = await obtenirSession();
  if (!(await estVraimentSuperAdmin(session))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { module: nomModule, actif } = await request.json();
  if (!nomModule) return NextResponse.json({ erreur: "Module manquant." }, { status: 400 });
  // Sans courriel, personne ne recevrait son code : les gérants seraient enfermés dehors
  if (nomModule === "double_verification" && actif && !process.env.RESEND_API_KEY) {
    return NextResponse.json({ erreur: "La double vérification envoie un code par courriel : configure d'abord l'envoi de courriel (RESEND_API_KEY)." }, { status: 409 });
  }

  // Sans clés Stripe, aucun paiement ne pourrait s'ouvrir ni s'inscrire
  if (nomModule === "paiement_en_ligne" && actif && !(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ erreur: "Le paiement en ligne exige les clés de Stripe : ajoute STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET dans les variables Railway de l'installation." }, { status: 409 });
  }

  // Sans les clés de Twilio, aucun texto ne pourrait partir
  if (nomModule === "textos" && actif && !(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_NUMERO || process.env.TWILIO_MESSAGING_SERVICE_SID))) {
    return NextResponse.json({ erreur: "Les textos automatiques exigent un compte Twilio : ajoute TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_NUMERO dans les variables Railway de l'installation." }, { status: 409 });
  }

  // Option du forfait Immobilier : relié à la comptabilité (lib/immobilierCompta.js)
  if (nomModule === "immobilier_comptabilite" && actif) {
    const cles = Object.fromEntries((await prisma.parametre.findMany({ where: { cle: { in: ["module_immobilier", "module_comptabilite"] } } })).map((p) => [p.cle, p.valeur]));
    if (cles.module_immobilier !== "actif") return NextResponse.json({ erreur: "Active d'abord le module Immobilier." }, { status: 409 });
    if (cles.module_comptabilite === "inactif") return NextResponse.json({ erreur: "Le lien exige le module Comptabilité : active-le d'abord." }, { status: 409 });
  }

  await prisma.parametre.upsert({
    where: { cle: `module_${nomModule}` },
    update: { valeur: actif ? "actif" : "inactif" },
    create: { cle: `module_${nomModule}`, valeur: actif ? "actif" : "inactif" },
  });

  return NextResponse.json({ ok: true });
}
