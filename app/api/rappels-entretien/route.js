import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection, estGerantOuDev } from "@/lib/auth";
import { envoyerRappels, enregistrerReglagesRappels } from "@/lib/rappelsEntretien";

// Envoie les rappels d'entretien des véhicules cochés (Clients → Rappels
// d'entretien) — voir lib/rappelsEntretien.js
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { vehiculeIds } = await request.json().catch(() => ({}));
  if (!Array.isArray(vehiculeIds) || vehiculeIds.length === 0) return NextResponse.json({ erreur: "Coche au moins un véhicule." }, { status: 400 });
  const resultat = await envoyerRappels({ vehiculeIds: vehiculeIds.map(String) });
  if (resultat.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: 503 });
  return NextResponse.json(resultat);
}

// Réglages (délai en mois, envoi automatique, lien de réservation) : gérant seulement
export async function PATCH(request) {
  const session = await obtenirSession();
  if (!estGerantOuDev(session) || !(await aAccesSection(session, "clients"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const { mois, auto, lien } = await request.json().catch(() => ({}));
  const resultat = await enregistrerReglagesRappels({ mois, auto, lien });
  if (resultat.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 });
  return NextResponse.json({ ok: true });
}
