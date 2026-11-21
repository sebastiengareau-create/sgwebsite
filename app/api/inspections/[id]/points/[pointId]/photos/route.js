import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { inspectionModifiable, refusInspection } from "@/lib/inspections";

const TAILLE_MAX = 4 * 1024 * 1024; // caractères de la data URL (photo déjà réduite dans le navigateur)

// Ajoute une photo à un point d'une inspection en cours : { dataUrl } → { id }
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { inspection, erreur, status } = await inspectionModifiable(params.id);
  if (erreur) return NextResponse.json({ erreur }, { status });
  if (inspection.statut !== "EN_COURS") {
    return NextResponse.json({ erreur: "L'inspection est terminée : rouvre-la pour ajouter une photo." }, { status: 409 });
  }
  const point = await prisma.pointInspection.findFirst({ where: { id: params.pointId, inspectionId: inspection.id }, select: { id: true } });
  if (!point) return NextResponse.json({ erreur: "Point introuvable." }, { status: 404 });

  const { dataUrl } = await request.json().catch(() => ({}));
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl || "") || dataUrl.length > TAILLE_MAX) {
    return NextResponse.json({ erreur: "Photo invalide ou trop lourde." }, { status: 400 });
  }
  const photo = await prisma.photoInspection.create({
    data: { pointId: point.id, url: dataUrl, employeId: session.id || null },
    select: { id: true },
  });
  return NextResponse.json(photo);
}
