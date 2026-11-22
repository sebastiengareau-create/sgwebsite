import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { inspectionModifiable, refusInspection } from "@/lib/inspections";

// Modifie l'en-tête d'une inspection, ou change son statut :
// { kilometrage?, noteGenerale?, action?: "terminer" | "rouvrir" }
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { inspection, erreur, status } = await inspectionModifiable(params.id);
  if (erreur) return NextResponse.json({ erreur }, { status });
  if (inspection.reponseClient) {
    return NextResponse.json({ erreur: "Le client a déjà répondu à ce rapport : il ne se modifie plus." }, { status: 409 });
  }

  const corps = await request.json().catch(() => ({}));
  const data = {};

  if (corps.action === "terminer") {
    const aVerifier = await prisma.pointInspection.count({ where: { inspectionId: inspection.id, etat: null } });
    if (aVerifier > 0) {
      return NextResponse.json({ erreur: `Il reste ${aVerifier} point${aVerifier > 1 ? "s" : ""} à vérifier (mets « S. O. » sur ce qui ne s'applique pas).` }, { status: 400 });
    }
    data.statut = "TERMINEE";
    data.termineeLe = new Date();
  } else if (corps.action === "rouvrir") {
    data.statut = "EN_COURS";
    data.termineeLe = null;
  } else if (corps.action) {
    return NextResponse.json({ erreur: "Action inconnue." }, { status: 400 });
  }

  if ("kilometrage" in corps) {
    const km = corps.kilometrage === "" || corps.kilometrage == null ? null : Math.round(Number(String(corps.kilometrage).replace(/\s/g, "")));
    if (km !== null && (!Number.isFinite(km) || km < 0 || km > 9999999)) {
      return NextResponse.json({ erreur: "Kilométrage invalide." }, { status: 400 });
    }
    data.kilometrage = km;
  }
  if ("noteGenerale" in corps) data.noteGenerale = String(corps.noteGenerale || "").trim().slice(0, 2000) || null;

  const maj = await prisma.inspection.update({
    where: { id: inspection.id },
    data,
    select: { statut: true, termineeLe: true, kilometrage: true, noteGenerale: true },
  });
  return NextResponse.json(maj);
}

// Supprime une inspection (commencée par erreur) avec ses points et photos —
// comptoir seulement, tant que le client n'a pas répondu
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session, { comptoir: true });
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { inspection, erreur, status } = await inspectionModifiable(params.id);
  if (erreur) return NextResponse.json({ erreur }, { status });
  if (inspection.reponseClient) {
    return NextResponse.json({ erreur: "Le client a déjà répondu à ce rapport : il se garde au dossier." }, { status: 409 });
  }
  await prisma.inspection.delete({ where: { id: inspection.id } });
  return NextResponse.json({ ok: true, bonId: inspection.bonId });
}
