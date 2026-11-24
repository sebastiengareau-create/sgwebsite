import { NextResponse } from "next/server";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { terminerEtatLieux } from "@/lib/etatsLieux";

// Termine l'état des lieux : PDF dans les documents du bail ; { faireSigner }
// demande aussi la signature en ligne au locateur et aux locataires
export async function POST(request, props) {
  const session = await sessionImmo();
  if (!session) return refus();
  const { id } = await props.params;
  const body = await request.json().catch(() => ({}));
  const r = await terminerEtatLieux(id, { faireSigner: body.faireSigner === true }, session.nom);
  if (r.erreur) return erreur(r.erreur, r.status || 400);
  return NextResponse.json({ ok: true, ...r });
}
