import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";
import { notifier, employesDuBon } from "@/lib/notifications";
import { descriptionTache, refusInspection } from "@/lib/inspections";
import { estARecommander } from "@/lib/grillesInspection";

// Ajoute au bon, en tâches, des travaux recommandés de l'inspection :
// { pointIds } (choisis par le comptoir, ex. approuvés au téléphone) ou,
// sans pointIds, tous ceux que le client a approuvés en ligne. Une tâche par
// point, reliée au point ; un point déjà ajouté ne l'est pas deux fois.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session, { comptoir: true });
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });

  const inspection = await prisma.inspection.findUnique({
    where: { id: params.id },
    select: { id: true, bonId: true, points: { orderBy: { ordre: "asc" } } },
  });
  if (!inspection) return NextResponse.json({ erreur: "Inspection introuvable." }, { status: 404 });
  if (await bonEstVerrouille(inspection.bonId)) return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });

  const { pointIds } = await request.json().catch(() => ({}));
  const choisis = Array.isArray(pointIds) ? new Set(pointIds) : null;
  const aAjouter = inspection.points.filter((pt) =>
    estARecommander(pt) && pt.recommandation?.trim() && !pt.problemeId
    && (choisis ? choisis.has(pt.id) : pt.approbation === "APPROUVE"));
  if (aAjouter.length === 0) return NextResponse.json({ erreur: "Aucun travail à ajouter au bon." }, { status: 400 });

  const taches = await prisma.$transaction(async (tx) => {
    const creees = [];
    for (const pt of aAjouter) {
      const probleme = await tx.probleme.create({ data: { description: descriptionTache(pt), bonId: inspection.bonId }, select: { id: true, description: true } });
      await tx.pointInspection.update({ where: { id: pt.id }, data: { problemeId: probleme.id } });
      creees.push({ pointId: pt.id, ...probleme });
    }
    return creees;
  });

  after(async () => {
    const bon = await prisma.bonTravail.findUnique({ where: { id: inspection.bonId }, select: { numero: true, client: { select: { nom: true } } } });
    await notifier("BON_MODIFIE", {
      employeIds: await employesDuBon(inspection.bonId),
      sauf: [session.id],
      titre: `🔧 ${taches.length > 1 ? `${taches.length} tâches ajoutées` : "Tâche ajoutée"} — bon #${bon.numero}`,
      corps: `${bon.client.nom} · ${taches.map((t) => t.description).join(" · ")}`,
      url: `/bons/${inspection.bonId}`,
    });
  });
  return NextResponse.json({ taches });
}
