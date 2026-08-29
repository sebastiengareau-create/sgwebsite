import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, numero, qte, qteMin, prix, coutant, categorie } = await request.json();
  if (!nom || !numero || prix === undefined) {
    return NextResponse.json({ erreur: "Champs manquants." }, { status: 400 });
  }

  const existante = await prisma.piece.findUnique({ where: { numero } });
  if (existante) {
    return NextResponse.json({ erreur: "Ce numéro de pièce existe déjà." }, { status: 409 });
  }

  const piece = await prisma.piece.create({
    data: {
      nom,
      numero,
      qte: Number(qte) || 0,
      qteMin: Number(qteMin) || 0,
      prix: Number(prix),
      coutant: Number(coutant) || 0,
      categorie: categorie || "PIECE",
    },
  });
  return NextResponse.json(piece);
}
