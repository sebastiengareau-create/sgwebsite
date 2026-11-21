import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { assurerLienInspection, refusInspection } from "@/lib/inspections";

// Lien du rapport d'inspection (créé au besoin), pour l'envoyer au client par
// texto ou l'ouvrir — l'envoi par texto compte comme un envoi
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session, { comptoir: true });
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });

  const inspection = await prisma.inspection.findUnique({ where: { id: params.id }, select: { id: true, statut: true } });
  if (!inspection) return NextResponse.json({ erreur: "Inspection introuvable." }, { status: 404 });
  if (inspection.statut !== "TERMINEE") {
    return NextResponse.json({ erreur: "Termine l'inspection avant d'envoyer le rapport." }, { status: 409 });
  }
  const lien = await assurerLienInspection(inspection.id);
  const { texto } = await request.json().catch(() => ({}));
  if (texto) await prisma.inspection.update({ where: { id: inspection.id }, data: { envoyeeLe: new Date() } });
  return NextResponse.json({ lien });
}
