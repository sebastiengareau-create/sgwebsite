import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, numero, qte, qteMin, qteMax, emplacement, fournisseurId, prix, coutant, categorie } = await request.json();
  if (!nom || !numero || prix === undefined) {
    return NextResponse.json({ erreur: "Champs manquants." }, { status: 400 });
  }

  const existante = await prisma.piece.findUnique({ where: { numero } });
  if (existante) {
    return NextResponse.json({ erreur: "Ce numéro de pièce existe déjà." }, { status: 409 });
  }

  const qteInitiale = Number(qte) || 0;
  const piece = await prisma.piece.create({
    data: {
      nom,
      numero,
      qte: qteInitiale,
      qteMin: Number(qteMin) || 0,
      qteMax: qteMax !== undefined && qteMax !== "" ? Number(qteMax) : null,
      emplacement: emplacement || null,
      fournisseurId: fournisseurId || null,
      prix: Number(prix),
      coutant: Number(coutant) || 0,
      categorie: categorie || "PIECE",
      ...(qteInitiale !== 0 && {
        mouvements: {
          create: { type: "AJUSTEMENT", qte: qteInitiale, solde: qteInitiale, note: "Stock de départ", creePar: session.nom },
        },
      }),
    },
  });
  return NextResponse.json(piece);
}
