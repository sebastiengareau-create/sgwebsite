import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { envoyerRelevesRetards } from "@/lib/immobilierCourriel";

// Envoie le relevé de compte à tous les locataires qui ont un solde dû
export async function POST() {
  const session = await sessionImmo();
  if (!session) return refus();
  const r = await envoyerRelevesRetards(session.nom);
  if (r.erreur) return erreur(r.erreur);
  return NextResponse.json({ ok: true, ...r });
}
