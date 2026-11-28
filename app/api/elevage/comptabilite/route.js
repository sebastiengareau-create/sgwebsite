import { NextResponse } from "next/server";
import { aAccesSection } from "@/lib/auth";
import { sessionElevage } from "@/lib/elevage";
import { enregistrerLienComptaElevage, synchroniserComptaElevage, lienComptaElevageActif } from "@/lib/elevageCompta";

// Élevage relié à la comptabilité (lib/elevageCompta.js), une fois l'option
// activée dans Administrateur → Modules : { depuis: "2026-12-01",
// tresorerieId } — ou { synchroniser: true } pour remettre les livres à jour
// tout de suite. Exige aussi l'accès « Comptabilité ».
export async function POST(req) {
  const session = await sessionElevage();
  if (!session || !(await aAccesSection(session, "comptabilite"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.synchroniser === true) {
    if (!(await lienComptaElevageActif())) return NextResponse.json({ erreur: "Le lien avec la comptabilité est inactif." }, { status: 400 });
    return NextResponse.json({ ok: true, resultat: await synchroniserComptaElevage({ creePar: session.nom }) });
  }
  const r = await enregistrerLienComptaElevage(body);
  if (r.erreur) return NextResponse.json({ erreur: r.erreur }, { status: 400 });
  // Date de départ ou compte changés : les livres suivent tout de suite
  const resultat = (await lienComptaElevageActif()) ? await synchroniserComptaElevage({ creePar: session.nom }) : null;
  return NextResponse.json({ ok: true, reglages: r.reglages, resultat });
}
