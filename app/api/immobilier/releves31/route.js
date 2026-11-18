import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";

const aujourdhui = () => new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date())}T12:00:00Z`);

// Suivi du relevé 31 d'un bail : { annee, bailIds: [...], produit?: bool, remis?: bool }
// (true = aujourd'hui, false = efface la date)
export async function POST(request) {
  const session = await sessionImmo();
  if (!session) return refus();
  const body = await request.json().catch(() => ({}));
  const annee = Number(body.annee);
  const ids = Array.isArray(body.bailIds) ? body.bailIds.filter((x) => typeof x === "string") : [];
  if (!(annee >= 2000 && annee <= 2100) || ids.length === 0) return erreur("Année ou bail manquant.");
  const data = {};
  if (typeof body.produit === "boolean") data.produitLe = body.produit ? aujourdhui() : null;
  if (typeof body.remis === "boolean") data.remisLe = body.remis ? aujourdhui() : null;
  try {
    for (const bailId of ids) {
      await prisma.releve31Immo.upsert({ where: { annee_bailId: { annee, bailId } }, update: data, create: { annee, bailId, ...data, creePar: session.nom } });
    }
  } catch (e) {
    if (e?.code === "P2003") return erreur("Bail introuvable.", 404);
    throw e;
  }
  return NextResponse.json({ ok: true });
}
