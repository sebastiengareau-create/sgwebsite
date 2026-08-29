import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { statut } = await request.json();
  if (!["EN_ATTENTE", "EN_COURS", "TERMINE"].includes(statut)) {
    return NextResponse.json({ erreur: "Statut invalide." }, { status: 400 });
  }

  await prisma.bonTravail.update({ where: { id: params.id }, data: { statut } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const bon = await prisma.bonTravail.findUnique({ where: { id: params.id }, include: { facture: true } });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });

  if (bon.facture) {
    return NextResponse.json(
      { erreur: "Ce bon a déjà une facture émise — il ne peut pas être supprimé (ça effacerait un document officiel). Tu peux annuler la facture depuis la fiche du bon si nécessaire." },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    const problemes = await tx.probleme.findMany({ where: { bonId: params.id }, include: { pieces: true } });

    // Remet en stock toutes les pièces utilisées sur ce bon avant de le supprimer
    for (const pr of problemes) {
      for (const ligne of pr.pieces) {
        await tx.piece.update({ where: { id: ligne.pieceId }, data: { qte: { increment: ligne.qte } } });
      }
    }

    // Les entrées de temps sont maintenant rattachées à chaque tâche (Probleme),
    // pas au bon directement — on les retire d'abord pour chaque tâche
    const idsProblemes = problemes.map((pr) => pr.id);
    await tx.entreeTemps.deleteMany({ where: { problemeId: { in: idsProblemes } } });

    // Les problèmes, photos et pièces se suppriment automatiquement (cascade)
    await tx.bonTravail.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}
