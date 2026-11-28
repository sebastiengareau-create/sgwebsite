import { NextResponse } from "next/server";
import { aAccesSection } from "@/lib/auth";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { enregistrerLienCompta, synchroniserComptaImmo, lireLienCompta, lienComptaActif } from "@/lib/immobilierCompta";

// Immobilier relié à la comptabilité (lib/immobilierCompta.js) :
// { actif, depuis: "2026-12-01", tresorerieId } — ou { synchroniser: true }
// pour remettre les livres à jour tout de suite. Exige aussi l'accès
// « Comptabilité ».
export async function POST(req) {
  const session = await sessionImmo();
  if (!session || !(await aAccesSection(session, "comptabilite"))) return refus();
  const body = await req.json().catch(() => ({}));
  if (body.synchroniser === true) {
    if (!(await lienComptaActif())) return erreur("Le lien avec la comptabilité est inactif.");
    return NextResponse.json({ ok: true, resultat: await synchroniserComptaImmo({ creePar: session.nom }) });
  }
  const r = await enregistrerLienCompta(body);
  if (r.erreur) return erreur(r.erreur);
  // Activé, ou date de départ ou compte changés : les livres suivent tout de suite
  const resultat = (await lienComptaActif(await lireLienCompta())) ? await synchroniserComptaImmo({ creePar: session.nom }) : null;
  return NextResponse.json({ ok: true, reglages: r.reglages, resultat });
}
