import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { inspectionModifiable, refusInspection } from "@/lib/inspections";

// Ajoute un point hors grille à une section : { section, libelle } → le point
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session);
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });
  const { inspection, erreur, status } = await inspectionModifiable(params.id);
  if (erreur) return NextResponse.json({ erreur }, { status });
  if (inspection.statut !== "EN_COURS") {
    return NextResponse.json({ erreur: "L'inspection est terminée : rouvre-la pour y ajouter un point." }, { status: 409 });
  }

  const corps = await request.json().catch(() => ({}));
  const section = String(corps.section || "").trim().slice(0, 80);
  const libelle = String(corps.libelle || "").trim().slice(0, 120);
  if (!section || !libelle) return NextResponse.json({ erreur: "Nomme le point à ajouter." }, { status: 400 });

  // À la fin de sa section
  const dernier = await prisma.pointInspection.findFirst({
    where: { inspectionId: inspection.id, section },
    orderBy: { ordre: "desc" },
    select: { ordre: true },
  });
  const suivant = dernier
    ? await prisma.pointInspection.findFirst({ where: { inspectionId: inspection.id, ordre: { gt: dernier.ordre } }, orderBy: { ordre: "asc" }, select: { ordre: true } })
    : null;
  let ordre;
  if (!dernier) {
    const max = await prisma.pointInspection.aggregate({ where: { inspectionId: inspection.id }, _max: { ordre: true } });
    ordre = (max._max.ordre || 0) + 10;
  } else if (!suivant) {
    ordre = dernier.ordre + 10;
  } else if (suivant.ordre - dernier.ordre > 1) {
    ordre = Math.floor((dernier.ordre + suivant.ordre) / 2);
  } else {
    // Plus de place entre les deux : on décale le reste de l'inspection
    await prisma.pointInspection.updateMany({ where: { inspectionId: inspection.id, ordre: { gt: dernier.ordre } }, data: { ordre: { increment: 10 } } });
    ordre = dernier.ordre + 5;
  }

  const point = await prisma.pointInspection.create({
    data: { inspectionId: inspection.id, section, libelle, ordre, ajoute: true },
    include: { photos: { select: { id: true } } },
  });
  return NextResponse.json(point);
}
