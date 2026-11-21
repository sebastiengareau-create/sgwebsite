import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";
import { notifier, employesDuBon } from "@/lib/notifications";
import { descriptionRappel, refusInspection } from "@/lib/inspections";
import { estARecommander } from "@/lib/grillesInspection";

// Point d'une inspection précédente, encore à revoir (lib/inspections.js,
// pointsARevoir) → { point, vehiculeId } ou { erreur, status }
async function pointARevoir(pointId) {
  const point = await prisma.pointInspection.findUnique({
    where: { id: pointId },
    include: { inspection: { select: { statut: true, bon: { select: { vehiculeId: true } } } } },
  });
  if (!point || point.inspection.statut !== "TERMINEE") return { erreur: "Point introuvable.", status: 404 };
  if (!estARecommander(point) || point.problemeId || point.rappelEcarteLe) {
    return { erreur: "Ce point n'est plus à revoir.", status: 409 };
  }
  return { point, vehiculeId: point.inspection.bon.vehiculeId };
}

// Ajoute au bon de la visite en cours le travail d'un point à revoir :
// { bonId } → { tache }. Le point est alors réglé (relié à la tâche).
export async function POST(request, props) {
  const { pointId } = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session, { comptoir: true });
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });

  const { point, vehiculeId, erreur, status } = await pointARevoir(pointId);
  if (erreur) return NextResponse.json({ erreur }, { status });
  const { bonId } = await request.json().catch(() => ({}));
  const bon = bonId ? await prisma.bonTravail.findUnique({ where: { id: bonId }, select: { id: true, numero: true, vehiculeId: true, client: { select: { nom: true } } } }) : null;
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });
  if (!vehiculeId || bon.vehiculeId !== vehiculeId) return NextResponse.json({ erreur: "Ce point vient d'un autre véhicule." }, { status: 400 });
  if (await bonEstVerrouille(bon.id)) return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });

  const tache = await prisma.$transaction(async (tx) => {
    const probleme = await tx.probleme.create({ data: { description: descriptionRappel(point), bonId: bon.id }, select: { id: true, description: true } });
    await tx.pointInspection.update({ where: { id: point.id }, data: { problemeId: probleme.id } });
    return probleme;
  });

  after(async () => {
    await notifier("BON_MODIFIE", {
      employeIds: await employesDuBon(bon.id),
      sauf: [session.id],
      titre: `🔧 Tâche ajoutée — bon #${bon.numero}`,
      corps: `${bon.client.nom} · ${tache.description}`,
      url: `/bons/${bon.id}`,
    });
  });
  return NextResponse.json({ tache });
}

// Écarte un point à revoir (ex. fait ailleurs) : il ne revient plus
export async function DELETE(request, props) {
  const { pointId } = await props.params;
  const session = await obtenirSession();
  const refus = await refusInspection(session, { comptoir: true });
  if (refus) return NextResponse.json({ erreur: refus.erreur }, { status: refus.status });

  const { point, erreur, status } = await pointARevoir(pointId);
  if (erreur) return NextResponse.json({ erreur }, { status });
  await prisma.pointInspection.update({ where: { id: point.id }, data: { rappelEcarteLe: new Date() } });
  return NextResponse.json({ ok: true });
}
