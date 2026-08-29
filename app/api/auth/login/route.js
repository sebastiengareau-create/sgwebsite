import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, creerJetonSession, COOKIE_NAME } from "@/lib/auth";

export async function POST(request) {
  const { courriel, motDePasse } = await request.json();

  // Accès développeur — jamais un compte employé, jamais dans la base de
  // données de l'installation. Vérifié en premier, avant même de toucher
  // à la table des employés du garage.
  if (
    process.env.DEVELOPER_EMAIL &&
    process.env.DEVELOPER_PASSWORD &&
    courriel === process.env.DEVELOPER_EMAIL &&
    motDePasse === process.env.DEVELOPER_PASSWORD
  ) {
    const jetonDev = await creerJetonSession({ id: "developpeur", role: "DEVELOPPEUR", nom: process.env.DEVELOPER_NOM || "Développeur" });
    const reponseDev = NextResponse.json({ role: "DEVELOPPEUR", nom: process.env.DEVELOPER_NOM || "Développeur" });
    reponseDev.cookies.set(COOKIE_NAME, jetonDev, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return reponseDev;
  }

  const utilisateur = await prisma.user.findUnique({ where: { courriel } });
  if (!utilisateur || !utilisateur.actif) {
    return NextResponse.json({ erreur: "Courriel ou mot de passe incorrect." }, { status: 401 });
  }

  const valide = await verifyPassword(motDePasse, utilisateur.motDePasse);
  if (!valide) {
    return NextResponse.json({ erreur: "Courriel ou mot de passe incorrect." }, { status: 401 });
  }

  const jeton = await creerJetonSession({ id: utilisateur.id, role: utilisateur.role, nom: utilisateur.nom });

  const reponse = NextResponse.json({ role: utilisateur.role, nom: utilisateur.nom });
  reponse.cookies.set(COOKIE_NAME, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 heures — un quart de travail
  });
  return reponse;
}
