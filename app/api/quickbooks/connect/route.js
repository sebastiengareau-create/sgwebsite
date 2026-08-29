import { NextResponse } from "next/server";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { urlConnexion } from "@/lib/quickbooks";
import crypto from "crypto";

export async function GET() {
  const session = await obtenirSession();
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Seul le gérant peut connecter QuickBooks." }, { status: 403 });
  }

  // Le "state" protège contre les faux retours de connexion (CSRF)
  const etat = crypto.randomBytes(16).toString("hex");
  const reponse = NextResponse.redirect(urlConnexion(etat));
  reponse.cookies.set("qb_state", etat, { httpOnly: true, maxAge: 600, path: "/" });
  return reponse;
}
