import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

// Remet une soumission acceptée en attente. Le bon créé à partir d'elle est
// supprimé s'il est encore vide (aucun temps poinçonné, aucune pièce) ; un
// bon déjà commencé ou facturé n'est jamais touché — on refuse.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const soumission = await prisma.soumission.findUnique({ where: { id: params.id } });
  if (!soumission) return NextResponse.json({ erreur: "Soumission introuvable." }, { status: 404 });

  const bon = soumission.bonId
    ? await prisma.bonTravail.findUnique({
        where: { id: soumission.bonId },
        include: { facture: true, problemes: { include: { _count: { select: { pieces: true, entreesTemps: true } } } } },
      })
    : null;

  if (bon) {
    if (bon.facture) {
      return NextResponse.json({ erreur: `Le bon #${bon.numero} de cette soumission est déjà facturé (${bon.facture.numero}) — elle ne peut plus revenir en attente.` }, { status: 409 });
    }
    const commence = bon.problemes.some((pr) => pr._count.pieces > 0 || pr._count.entreesTemps > 0);
    if (commence) {
      return NextResponse.json({ erreur: `Le bon #${bon.numero} de cette soumission a déjà du temps ou des pièces. Supprime d'abord ce bon (sa fiche), puis remets la soumission en attente.` }, { status: 409 });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (bon) {
      await tx.rendezVous.deleteMany({ where: { bonId: bon.id, source: "BON" } });
      await tx.bonTravail.delete({ where: { id: bon.id } }); // tâches et photos en cascade
    }
    await tx.soumission.update({ where: { id: soumission.id }, data: { statut: "EN_ATTENTE", bonId: null } });
  });

  return NextResponse.json({ ok: true, bonSupprime: bon?.numero || null });
}
