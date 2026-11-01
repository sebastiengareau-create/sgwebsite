import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { remettreLigneEnStock } from "@/lib/bons";
import { estLignePieceSoumission } from "@/lib/piecesSoumission";

// Remet une soumission acceptée (ou facturée puis annulée) en attente. Le bon
// créé à partir d'elle est supprimé s'il n'a pas encore de temps poinçonné ;
// ses pièces reviennent alors en stock (celles de l'inventaire de la
// soumission comme celles ajoutées depuis), comme à la suppression d'un bon.
// Un bon dont la facture est annulée reste tel quel avec elle (document
// officiel) : la soumission en est seulement détachée, et pourra être
// facturée de nouveau — ses pièces de l'inventaire reviennent en stock (la
// ligne garde sa quantité et son prix en ligne fixe), pour ne pas sortir deux
// fois du stock à la prochaine facture. Un bon commencé ou avec une facture
// en vigueur n'est jamais touché — on refuse.
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
        include: { facture: true, problemes: { include: { pieces: true, _count: { select: { entreesTemps: true } } } } },
      })
    : null;

  if (bon) {
    if (bon.facture && bon.facture.statut !== "ANNULEE") {
      return NextResponse.json({ erreur: `Le bon #${bon.numero} de cette soumission est facturé (${bon.facture.numero}). Annule d'abord cette facture (fiche du bon), puis remets la soumission en attente.` }, { status: 409 });
    }
    const commence = !bon.facture && bon.problemes.some((pr) => pr._count.entreesTemps > 0);
    if (commence) {
      return NextResponse.json({ erreur: `Le bon #${bon.numero} de cette soumission a déjà du temps poinçonné. Supprime d'abord ce bon (sa fiche), puis remets la soumission en attente.` }, { status: 409 });
    }
  }

  await prisma.$transaction(async (tx) => {
    // Facture annulée : le bon et la facture restent, seulement détachés ;
    // les pièces de l'inventaire de la soumission reviennent en stock
    if (bon?.facture) {
      for (const pr of bon.problemes.filter(estLignePieceSoumission)) {
        if (pr.pieces.length === 0) continue;
        const qte = pr.pieces.reduce((s, l) => s + l.qte, 0);
        const total = pr.pieces.reduce((s, l) => s + l.qte * l.prix, 0);
        for (const ligne of pr.pieces) {
          await remettreLigneEnStock(tx, ligne, { note: `Soumission #${soumission.numero} remise en attente — Bon #${bon.numero}`, creePar: session.nom });
          await tx.pieceUtilisee.delete({ where: { id: ligne.id } });
        }
        await tx.probleme.update({ where: { id: pr.id }, data: { factureQte: qte, facturePrixUnitaire: qte ? total / qte : 0 } });
      }
    }
    if (bon && !bon.facture) {
      for (const pr of bon.problemes) {
        for (const ligne of pr.pieces) {
          await remettreLigneEnStock(tx, ligne, { note: `Soumission #${soumission.numero} remise en attente — Bon #${bon.numero} supprimé`, creePar: session.nom });
        }
      }
      await tx.rendezVous.deleteMany({ where: { bonId: bon.id, source: "BON" } });
      await tx.bonTravail.delete({ where: { id: bon.id } }); // tâches et photos en cascade
    }
    await tx.soumission.update({ where: { id: soumission.id }, data: { statut: "EN_ATTENTE", bonId: null } });
  });

  return NextResponse.json({ ok: true, bonSupprime: bon && !bon.facture ? bon.numero : null });
}
