import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const { prix, qte } = await request.json();

  const ligne = await prisma.pieceUtilisee.findUnique({
    where: { id: params.pieceUtiliseeId },
    include: { probleme: true },
  });
  if (!ligne || ligne.probleme.bonId !== params.id) {
    return NextResponse.json({ erreur: "Ligne introuvable." }, { status: 404 });
  }

  const data = {};
  if (prix !== undefined) {
    const nouveauPrix = Number(prix);
    if (isNaN(nouveauPrix) || nouveauPrix < 0) return NextResponse.json({ erreur: "Prix invalide." }, { status: 400 });
    data.prix = nouveauPrix;
  }

  // Si la quantité change, ajuster l'inventaire en conséquence (la
  // différence est remise en stock ou déduite selon le sens du changement)
  if (qte !== undefined) {
    const nouvelleQte = Number(qte);
    if (isNaN(nouvelleQte) || nouvelleQte < 1) return NextResponse.json({ erreur: "Quantité invalide." }, { status: 400 });
    const difference = nouvelleQte - ligne.qte; // positif = en prendre plus au stock

    try {
      await prisma.$transaction(async (tx) => {
        if (difference !== 0) {
          const piece = await tx.piece.findUnique({ where: { id: ligne.pieceId } });
          if (difference > 0 && piece.qte < difference) throw new Error("STOCK_INSUFFISANT");
          await tx.piece.update({ where: { id: ligne.pieceId }, data: { qte: piece.qte - difference } });
        }
        await tx.pieceUtilisee.update({ where: { id: ligne.id }, data: { ...data, qte: nouvelleQte } });
      });
    } catch (e) {
      if (e.message === "STOCK_INSUFFISANT") {
        return NextResponse.json({ erreur: "Stock insuffisant pour cette nouvelle quantité." }, { status: 409 });
      }
      throw e;
    }
    const misAJour = await prisma.pieceUtilisee.findUnique({ where: { id: ligne.id } });
    return NextResponse.json(misAJour);
  }

  const misAJour = await prisma.pieceUtilisee.update({ where: { id: ligne.id }, data });
  return NextResponse.json(misAJour);
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    const ligne = await tx.pieceUtilisee.findUnique({
      where: { id: params.pieceUtiliseeId },
      include: { probleme: true },
    });
    if (!ligne || ligne.probleme.bonId !== params.id) return; // pas la bonne ligne

    await tx.piece.update({ where: { id: ligne.pieceId }, data: { qte: { increment: ligne.qte } } });
    await tx.pieceUtilisee.delete({ where: { id: ligne.id } });
  });

  return NextResponse.json({ ok: true });
}
