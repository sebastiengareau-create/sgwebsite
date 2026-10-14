import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { ajouterACommande } from "@/lib/brouillonsCommande";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE, sortirDuStockPourBon } from "@/lib/bons";

// Pièce de l'inventaire ajoutée à une tâche sans assez de stock (souvent 0) :
// ce qu'il y a en stock en sort normalement, le reste est commandé — ajouté au
// brouillon de commande du fournisseur choisi — et mis sur la tâche en B/O. La
// ligne B/O compte dans le total du bon et sort du stock à la réception de la
// commande (sortirPiecesBoRecues, lib/brouillonsCommande.js) ; le bon ne se
// facture pas avant. On peut commander plus que le manque (qteCommande) :
// le surplus entre simplement en stock à la réception. Le lien est une pièce à commander du bon déjà commandée,
// comme « 🛒 Commander » : elle apparaît avec le suivi de sa commande.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé : commander demande l'accès à l'inventaire." }, { status: 403 });
  }
  if (await bonEstVerrouille(params.id)) {
    return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  }

  const corps = await request.json().catch(() => ({}));
  const quantite = Number(corps.qte);
  if (!corps.problemeId || !corps.pieceId || !Number.isInteger(quantite) || quantite < 1 || quantite > 999) {
    return NextResponse.json({ erreur: "Données invalides." }, { status: 400 });
  }
  const probleme = await prisma.probleme.findUnique({ where: { id: corps.problemeId }, include: { bon: { include: { client: true } } } });
  if (!probleme || probleme.bonId !== params.id) {
    return NextResponse.json({ erreur: "Ligne de problème introuvable." }, { status: 404 });
  }
  const piece = await prisma.piece.findUnique({ where: { id: corps.pieceId } });
  if (!piece) return NextResponse.json({ erreur: "Pièce introuvable." }, { status: 404 });
  if (!piece.actif) return NextResponse.json({ erreur: "Cette pièce est désactivée dans l'inventaire." }, { status: 409 });
  const fournisseur = corps.fournisseurId ? await prisma.fournisseur.findUnique({ where: { id: corps.fournisseurId } }) : null;
  if (!fournisseur || !fournisseur.actif) return NextResponse.json({ erreur: "Choisis le fournisseur chez qui commander." }, { status: 400 });

  const enStock = Math.max(0, Math.min(piece.qte, quantite));
  const aCommander = quantite - enStock;
  if (aCommander === 0) {
    return NextResponse.json({ erreur: "Cette pièce est en stock — ajoute-la normalement." }, { status: 409 });
  }
  const qteCommande = corps.qteCommande === undefined || corps.qteCommande === "" ? aCommander : Number(corps.qteCommande);
  if (!Number.isInteger(qteCommande) || qteCommande > 999) {
    return NextResponse.json({ erreur: "Quantité à commander invalide." }, { status: 400 });
  }
  if (qteCommande < aCommander) {
    return NextResponse.json({ erreur: `Commande au moins ${aCommander} : c'est ce qui manque pour ce bon.` }, { status: 400 });
  }

  const commande = await ajouterACommande({
    fournisseurId: fournisseur.id,
    lignes: [{ pieceId: piece.id, qte: qteCommande }],
    ajouterAuBrouillon: true,
    note: `Pour le bon #${probleme.bon.numero}`,
    creePar: session.nom,
  });
  const lien = await prisma.pieceFournisseur.findUnique({ where: { pieceId_fournisseurId: { pieceId: piece.id, fournisseurId: fournisseur.id } } });

  try {
    await prisma.$transaction(async (tx) => {
      if (enStock > 0) {
        const aJour = await tx.piece.findUnique({ where: { id: piece.id } });
        await sortirDuStockPourBon(tx, { probleme, piece: aJour, quantite: enStock, creePar: session.nom });
      }
      const surBon = await tx.pieceUtilisee.create({
        data: { problemeId: probleme.id, pieceId: piece.id, qte: aCommander, prix: piece.prix, coutant: null, bo: true },
      });
      await tx.pieceACommander.create({
        data: {
          bonId: probleme.bonId, description: piece.nom, numero: lien?.numeroFournisseur || piece.numero,
          fournisseur: fournisseur.nom, prix: (lien?.coutant ?? piece.coutant) || null, qte: qteCommande, commandee: true,
          pieceId: piece.id, commandeId: commande.id, pieceUtiliseeId: surBon.id, creePar: session.nom,
        },
      });
    });
  } catch (e) {
    if (e.message === "STOCK_INSUFFISANT") {
      return NextResponse.json({ erreur: "Le stock vient de changer — réessaie." }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ...commande, enStock, aCommander, qteCommande });
}
