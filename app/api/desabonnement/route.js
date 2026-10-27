import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jetonDesabonnementValide } from "@/lib/courrielDocuments";

// Désabonnement des courriels de promotion — formulaire de la page
// publique /desabonnement (c = client, t = jeton du lien). Un POST, pas le
// simple fait d'ouvrir le lien : les antivirus de courriel ouvrent les liens
// d'avance. Le bouton « Se désabonner » des logiciels de courriel (en-tête
// List-Unsubscribe) passe aussi par la page.
export async function POST(request) {
  const donnees = await request.formData().catch(() => null);
  const c = String(donnees?.get("c") || "");
  const t = String(donnees?.get("t") || "");
  const retour = new URL(`/desabonnement?c=${encodeURIComponent(c)}&t=${encodeURIComponent(t)}`, request.url);
  if (!jetonDesabonnementValide(c, t)) return NextResponse.redirect(retour, 303);

  await prisma.client.updateMany({ where: { id: c, promotionsRefuseesLe: null }, data: { promotionsRefuseesLe: new Date() } });
  return NextResponse.redirect(retour, 303);
}
