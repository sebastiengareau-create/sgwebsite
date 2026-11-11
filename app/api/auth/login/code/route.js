import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reponseSessionOuverte, OPTIONS_TEMOIN } from "@/lib/sessionConnexion";
import { verifierCode, jetonAppareil, COOKIE_CODE, COOKIE_APPAREIL, DUREE_APPAREIL_S } from "@/lib/protectionConnexion";

// Deuxième étape de la connexion : le code reçu par courriel
// (lib/protectionConnexion.js). Le bon mot de passe a déjà été donné.
export async function POST(request) {
  const { code, memoriser } = await request.json().catch(() => ({}));
  const resultat = await verifierCode(request.cookies.get(COOKIE_CODE)?.value, code);
  if (!resultat.userId) {
    const reponse = NextResponse.json({ erreur: resultat.erreur, expire: !!resultat.expire }, { status: resultat.expire ? 410 : 401 });
    if (resultat.expire) reponse.cookies.set(COOKIE_CODE, "", { path: "/", maxAge: 0 });
    return reponse;
  }

  const utilisateur = await prisma.user.findUnique({ where: { id: resultat.userId }, omit: { motDePasse: false } });
  if (!utilisateur?.actif) return NextResponse.json({ erreur: "Ce compte n'est plus actif.", expire: true }, { status: 410 });

  const reponse = await reponseSessionOuverte(utilisateur);
  reponse.cookies.set(COOKIE_CODE, "", { path: "/", maxAge: 0 });
  if (memoriser) reponse.cookies.set(COOKIE_APPAREIL, jetonAppareil(utilisateur), { ...OPTIONS_TEMOIN, maxAge: DUREE_APPAREIL_S });
  return reponse;
}
