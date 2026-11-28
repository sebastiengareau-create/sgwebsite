import { NextResponse } from "next/server";
import { aAccesSection } from "@/lib/auth";
import { sessionCopro, refus, erreur } from "@/lib/copropriete";
import { enregistrerLienComptaCopro, synchroniserComptaCopro, lienComptaCoproActif } from "@/lib/coproprieteCompta";

// Copropriété reliée à la comptabilité (lib/coproprieteCompta.js), une fois
// l'option activée dans Administrateur → Modules : { depuis: "2026-12-01",
// tresorerieId } — ou { synchroniser: true } pour remettre les livres à jour
// tout de suite. Exige aussi l'accès « Comptabilité ».
export async function POST(req) {
  const session = await sessionCopro();
  if (!session || !(await aAccesSection(session, "comptabilite"))) return refus();
  const body = await req.json().catch(() => ({}));
  if (body.synchroniser === true) {
    if (!(await lienComptaCoproActif())) return erreur("Le lien avec la comptabilité est inactif.");
    return NextResponse.json({ ok: true, resultat: await synchroniserComptaCopro({ creePar: session.nom }) });
  }
  const r = await enregistrerLienComptaCopro(body);
  if (r.erreur) return erreur(r.erreur);
  // Date de départ ou compte changés : les livres suivent tout de suite
  const resultat = (await lienComptaCoproActif()) ? await synchroniserComptaCopro({ creePar: session.nom }) : null;
  return NextResponse.json({ ok: true, reglages: r.reglages, resultat });
}
