import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { alignerInventaireAuGL, calculerAlignementInventaire } from "@/lib/comptabilite";

export async function POST() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  try {
    await alignerInventaireAuGL(session.nom, "Alignement manuel");
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace(/^PERIODE_LOCK:/, "") }, { status: 423 });
  }
  return NextResponse.json(await calculerAlignementInventaire());
}
