import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { dateHeureLocaleVersUTC } from "@/lib/temps";

export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();
  const data = {};
  if (body.statut !== undefined) {
    if (!["EN_ATTENTE", "EN_COURS", "TERMINE"].includes(body.statut)) {
      return NextResponse.json({ erreur: "Statut invalide." }, { status: 400 });
    }
    data.statut = body.statut;
  }
  // Date prévue ("YYYY-MM-DDTHH:MM" en heure du Québec) — null la retire
  if (body.datePrevue !== undefined) {
    data.datePrevue = body.datePrevue ? dateHeureLocaleVersUTC(body.datePrevue) : null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ erreur: "Rien à modifier." }, { status: 400 });
  }

  await prisma.bonTravail.update({ where: { id: params.id }, data });
  // Date prévue changée : le rendez-vous du bon au calendrier suit
  if (data.datePrevue) {
    await prisma.rendezVous.updateMany({ where: { bonId: params.id, statut: { not: "ANNULE" } }, data: { date: data.datePrevue } });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, props) {
  const params = await props.params;
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

    // Le rendez-vous inscrit au calendrier par ce bon disparaît avec lui ; un
    // rendez-vous pris au calendrier ou sur le web reste (lien retiré).
    await tx.rendezVous.deleteMany({ where: { bonId: params.id, source: "BON" } });

    // Les problèmes, photos et pièces se suppriment automatiquement (cascade)
    await tx.bonTravail.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}
