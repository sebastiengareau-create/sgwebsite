// Ouverture de la session après une connexion réussie — partagée par la
// connexion (mot de passe) et la saisie du code de double vérification.
import { NextResponse } from "next/server";
import { creerJetonSession, COOKIE_NAME } from "./auth";

const SECURISE = process.env.NODE_ENV === "production";
export const OPTIONS_TEMOIN = { httpOnly: true, sameSite: "lax", secure: SECURISE, path: "/" };

export async function reponseSessionOuverte({ id, role, nom }) {
  const jeton = await creerJetonSession({ id, role, nom });
  const reponse = NextResponse.json({ role, nom });
  // 12 heures — un quart de travail
  reponse.cookies.set(COOKIE_NAME, jeton, { ...OPTIONS_TEMOIN, maxAge: 60 * 60 * 12 });
  return reponse;
}
