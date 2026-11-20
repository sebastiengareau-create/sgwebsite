import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { courrielConfigure, preparerCourriel, envoyerCourriels } from "@/lib/courrielDocuments";
import { reponseSessionOuverte, OPTIONS_TEMOIN } from "@/lib/sessionConnexion";
import {
  ipDeLaRequete, minutesDeBlocage, noterEchec, effacerEchecs, messageBlocage,
  doubleVerificationRequise, nouveauCode, appareilVerifie, masquerCourriel, COOKIE_CODE, COOKIE_APPAREIL,
} from "@/lib/protectionConnexion";

const REFUS = "Courriel ou mot de passe incorrect.";

export async function POST(request) {
  const { courriel, motDePasse } = await request.json().catch(() => ({}));
  if (typeof courriel !== "string" || typeof motDePasse !== "string" || !courriel || !motDePasse) {
    return NextResponse.json({ erreur: REFUS }, { status: 401 });
  }

  // Trop d'essais ratés (ce courriel ou cette adresse IP) : rien n'est même
  // vérifié — voir lib/protectionConnexion.js
  const ip = ipDeLaRequete(request);
  const minutes = await minutesDeBlocage(courriel, ip);
  if (minutes) return NextResponse.json({ erreur: messageBlocage(minutes) }, { status: 429 });

  // Accès développeur — jamais un compte employé, jamais dans la base de
  // données de l'installation. Vérifié en premier, avant même de toucher
  // à la table des employés du garage.
  if (
    process.env.DEVELOPER_EMAIL &&
    process.env.DEVELOPER_PASSWORD &&
    courriel === process.env.DEVELOPER_EMAIL &&
    motDePasse === process.env.DEVELOPER_PASSWORD
  ) {
    await effacerEchecs(courriel);
    return reponseSessionOuverte({ id: "developpeur", role: "DEVELOPPEUR", nom: process.env.DEVELOPER_NOM || "Développeur" });
  }

  // Seul endroit qui lit le mot de passe haché (masqué partout ailleurs, voir lib/prisma.js)
  const utilisateur = await prisma.user.findUnique({ where: { courriel }, omit: { motDePasse: false } });
  const valide = !!utilisateur?.actif && (await verifyPassword(motDePasse, utilisateur.motDePasse));
  if (!valide) {
    await noterEchec(courriel, ip);
    return NextResponse.json({ erreur: REFUS }, { status: 401 });
  }
  await effacerEchecs(courriel);

  // Double vérification : code par courriel, sauf sur un appareil déjà vérifié
  if ((await doubleVerificationRequise(utilisateur)) && !appareilVerifie(request.cookies.get(COOKIE_APPAREIL)?.value, utilisateur)) {
    if (!courrielConfigure()) {
      return NextResponse.json({ erreur: "La double vérification est active, mais l'envoi de courriel n'est pas configuré. Contacte l'administrateur du logiciel." }, { status: 503 });
    }
    const { code, jeton } = nouveauCode(utilisateur.id);
    const entreprise = await obtenirInfosEntreprise();
    const { echecs } = await envoyerCourriels([preparerCourriel({
      a: utilisateur.courriel,
      entreprise,
      sujet: `${code} — ton code de connexion`,
      texte: `Bonjour ${utilisateur.nom},\n\nTon code de connexion : ${code}\n\nIl est valide 10 minutes. Si tu n'essaies pas de te connecter, quelqu'un connaît ton mot de passe : change-le dès que possible.`,
    })]);
    if (echecs.length > 0) {
      console.error("Double vérification : envoi du code refusé —", echecs[0].erreur);
      return NextResponse.json({ erreur: "Impossible d'envoyer le code par courriel. Réessaie dans un instant." }, { status: 503 });
    }
    const reponse = NextResponse.json({ etape: "code", courriel: masquerCourriel(utilisateur.courriel) });
    reponse.cookies.set(COOKIE_CODE, jeton, { ...OPTIONS_TEMOIN, maxAge: 10 * 60 });
    return reponse;
  }

  return reponseSessionOuverte(utilisateur);
}
