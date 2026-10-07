import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { validerPieceACommander } from "@/lib/recherchePieces";

// Ajoute une pièce à la liste « à commander » du bon (résultat collé depuis
// le site d'un fournisseur). Liste de suivi seulement : ni inventaire, ni
// facture — donc permise même sur un bon facturé.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const bon = await prisma.bonTravail.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });

  const corps = await request.json().catch(() => ({}));
  const { data, erreur } = validerPieceACommander(corps);
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });

  const ligne = await prisma.pieceACommander.create({ data: { ...data, bonId: bon.id, creePar: session.nom } });
  return NextResponse.json(ligne);
}
