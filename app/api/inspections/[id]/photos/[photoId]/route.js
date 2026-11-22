import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { inspectionModifiable, refusInspection, reponseImage } from "@/lib/inspections";

// L'image d'une photo d'inspection, chargée à part. Une photo n'est jamais
// modifiée : le navigateur la garde en cache.
export async function GET(request, props) {
  const params = await props.params;
  if (!(await obtenirSession())) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  const photo = await prisma.photoInspection.findFirst({
    where: { id: params.photoId, point: { inspectionId: params.id } },
    select: { url: true },
  });
  if (!photo) return NextResponse.json({ erreur: "Photo introuvable." }, { status: 404 });
  return reponseImage(photo.url, request);
}

// Supprime une photo prise par erreur, tant que l'inspection est en cours
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { inspection, erreur, status } = await inspectionModifiable(params.id);
  if (erreur) return NextResponse.json({ erreur }, { status });
  if (inspection.statut !== "EN_COURS") {
    return NextResponse.json({ erreur: "L'inspection est terminée : rouvre-la pour retirer une photo." }, { status: 409 });
  }
  await prisma.photoInspection.deleteMany({ where: { id: params.photoId, point: { inspectionId: inspection.id } } });
  return NextResponse.json({ ok: true });
}
