import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();
  const data = {};
  if (body.nom !== undefined) data.nom = body.nom;
  if (body.numero !== undefined) data.numero = body.numero;
  if (body.qte !== undefined) data.qte = Number(body.qte);
  if (body.qteMin !== undefined) data.qteMin = Number(body.qteMin);
  if (body.prix !== undefined) data.prix = Number(body.prix);
  if (body.coutant !== undefined) data.coutant = Number(body.coutant);
  if (body.categorie !== undefined) data.categorie = body.categorie;

  try {
    const piece = await prisma.piece.update({ where: { id: params.id }, data });
    return NextResponse.json(piece);
  } catch (e) {
    if (e.code === "P2002") {
      return NextResponse.json({ erreur: "Ce numéro de pièce existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ erreur: "Erreur lors de la mise à jour." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const utilisee = await prisma.pieceUtilisee.count({ where: { pieceId: params.id } });
  if (utilisee > 0) {
    return NextResponse.json(
      { erreur: "Cette pièce a déjà été utilisée sur un ou des bons de travail — elle ne peut pas être supprimée (l'historique de facturation serait perdu). Tu peux mettre son stock à 0 à la place." },
      { status: 409 }
    );
  }

  await prisma.piece.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
