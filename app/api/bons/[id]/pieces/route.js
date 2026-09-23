import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const { problemeId, pieceId, qte } = await request.json();
  const quantite = Number(qte);
  if (!problemeId || !pieceId || !quantite || quantite < 1) {
    return NextResponse.json({ erreur: "Données invalides." }, { status: 400 });
  }

  // Sécurité : la ligne de problème doit vraiment appartenir à ce bon
  const probleme = await prisma.probleme.findUnique({ where: { id: problemeId }, include: { bon: { include: { client: true } } } });
  if (!probleme || probleme.bonId !== params.id) {
    return NextResponse.json({ erreur: "Ligne de problème introuvable." }, { status: 404 });
  }

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const piece = await tx.piece.findUnique({ where: { id: pieceId } });
      if (!piece) throw new Error("INTROUVABLE");
      if (piece.qte < quantite) throw new Error("STOCK_INSUFFISANT");

      const nouvelleQte = piece.qte - quantite;
      await tx.piece.update({
        where: { id: pieceId },
        data: {
          qte: nouvelleQte,
          mouvements: {
            create: {
              type: "VENTE", qte: -quantite, solde: nouvelleQte,
              note: `Bon #${probleme.bon.numero} — ${probleme.bon.client.nom}`, creePar: session.nom,
            },
          },
        },
      });

      // Le coût unitaire est figé à la sortie du stock : c'est lui que la
      // facture passera en coût des pièces vendues, même si le coût moyen de
      // la pièce change d'ici là (sinon inventaire et grand livre divergent).
      const existante = await tx.pieceUtilisee.findFirst({ where: { problemeId, pieceId } });
      if (existante) {
        const qteTotale = existante.qte + quantite;
        const coutant = (existante.qte * (existante.coutant ?? piece.coutant) + quantite * piece.coutant) / qteTotale;
        return tx.pieceUtilisee.update({ where: { id: existante.id }, data: { qte: qteTotale, coutant } });
      }
      return tx.pieceUtilisee.create({
        data: { problemeId, pieceId, qte: quantite, prix: piece.prix, coutant: piece.coutant },
      });
    });
    return NextResponse.json(resultat);
  } catch (e) {
    if (e.message === "STOCK_INSUFFISANT") {
      return NextResponse.json({ erreur: "Stock insuffisant pour cette quantité." }, { status: 409 });
    }
    return NextResponse.json({ erreur: "Pièce introuvable." }, { status: 404 });
  }
}
