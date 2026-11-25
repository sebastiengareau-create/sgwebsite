import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { enregistrerLocateur } from "@/lib/locateurImmo";

// Fiche du locateur (lib/locateurImmo.js) : { locateurs: [{ nom, no, rue,
// app, ville, codePostal, telephone, telephone2, courriel }], representant }
export async function POST(req) {
  const session = await sessionImmo();
  if (!session) return refus();
  const r = await enregistrerLocateur(await req.json().catch(() => ({})));
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true });
}
