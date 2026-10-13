import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { jetonAcces } from "@/lib/partstech";
import { CLIENT } from "@/lib/client";

// « Tester la connexion » : demande un jeton d'accès à PartsTech
export async function POST() {
  if (!CLIENT.partstech) return NextResponse.json({ erreur: "PartsTech n'est pas offert dans cette installation." }, { status: 404 });
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  try {
    await jetonAcces();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erreur: e.message }, { status: 502 });
  }
}
