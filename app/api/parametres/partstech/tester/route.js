import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { jetonAcces } from "@/lib/partstech";

// « Tester la connexion » : demande un jeton d'accès à PartsTech
export async function POST() {
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
