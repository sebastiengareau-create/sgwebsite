import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";
import { COMPTE_PIECES_SOUMISSION, lirePieceHorsInventaire } from "@/lib/piecesSoumission";

// Pièce hors inventaire : une pièce achetée pour ce bon seulement, facturée
// sans fiche d'inventaire ni mouvement de stock (lib/piecesSoumission.js).

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }
  const { data, erreur } = lirePieceHorsInventaire(await request.json());
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });

  const bon = await prisma.bonTravail.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });

  const ligne = await prisma.probleme.create({
    data: { ...data, bonId: bon.id, categorieRevenu: COMPTE_PIECES_SOUMISSION, factureDescription: "Pièce" },
  });
  return NextResponse.json(ligne);
}
