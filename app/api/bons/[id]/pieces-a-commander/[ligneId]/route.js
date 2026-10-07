import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { validerPieceACommander } from "@/lib/recherchePieces";

async function ligneDuBon(params) {
  const ligne = await prisma.pieceACommander.findUnique({ where: { id: params.ligneId } });
  return ligne && ligne.bonId === params.id ? ligne : null;
}

// Modifie une pièce à commander (ex. cochée « commandée »)
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (!(await ligneDuBon(params))) return NextResponse.json({ erreur: "Pièce introuvable." }, { status: 404 });

  const corps = await request.json().catch(() => ({}));
  const { data, erreur } = validerPieceACommander(corps, { partiel: true });
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });

  const ligne = await prisma.pieceACommander.update({ where: { id: params.ligneId }, data });
  return NextResponse.json(ligne);
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (!(await ligneDuBon(params))) return NextResponse.json({ erreur: "Pièce introuvable." }, { status: 404 });
  await prisma.pieceACommander.delete({ where: { id: params.ligneId } });
  return NextResponse.json({ ok: true });
}
