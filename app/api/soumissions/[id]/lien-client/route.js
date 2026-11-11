import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { assurerLienSoumission } from "@/lib/approbationSoumission";

// Lien d'approbation en ligne d'une soumission (créé au besoin) — à copier
// pour l'envoyer au client par texto ou autrement
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const lien = await assurerLienSoumission(params.id);
  if (!lien) return NextResponse.json({ erreur: "Soumission introuvable." }, { status: 404 });
  return NextResponse.json({ lien });
}
