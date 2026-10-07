import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { ajouterACommande } from "@/lib/brouillonsCommande";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

// « 🛒 Commander » une pièce à commander d'un bon : trouve sa fiche
// d'inventaire (par le numéro, chez ce fournisseur ou ailleurs) ou la crée
// (quantité 0), l'ajoute au brouillon de commande de ce fournisseur, et
// l'ajoute tout de suite à une tâche du bon en B/O : elle compte dans le
// total du bon, et sort du stock à la réception de la commande. La suite est
// le circuit habituel des commandes : envoyer, recevoir avec la facture
// (stock + dépense à payer), payer dans les comptes à payer.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé : commander demande l'accès à l'inventaire." }, { status: 403 });
  }

  const ligne = await prisma.pieceACommander.findUnique({
    where: { id: params.ligneId },
    include: { bon: { select: { numero: true } }, commande: { select: { statut: true } } },
  });
  if (!ligne || ligne.bonId !== params.id) return NextResponse.json({ erreur: "Pièce introuvable." }, { status: 404 });
  if (await bonEstVerrouille(params.id)) return NextResponse.json({ erreur: MESSAGE_BON_VERROUILLE }, { status: 409 });
  if (ligne.commande && ligne.commande.statut !== "ANNULEE") {
    return NextResponse.json({ erreur: "Cette pièce est déjà dans une commande." }, { status: 409 });
  }

  const corps = await request.json().catch(() => ({}));
  const numero = String(corps.numero || "").trim().slice(0, 60);
  const qte = Number(corps.qte);
  const cout = corps.coutUnitaire === "" || corps.coutUnitaire == null ? null : Number(String(corps.coutUnitaire).replace(",", "."));
  if (!numero) return NextResponse.json({ erreur: "Indique le numéro de la pièce chez le fournisseur." }, { status: 400 });
  if (!Number.isInteger(qte) || qte < 1 || qte > 999) return NextResponse.json({ erreur: "Quantité invalide." }, { status: 400 });
  if (cout !== null && !(cout >= 0)) return NextResponse.json({ erreur: "Coût unitaire invalide." }, { status: 400 });
  const tache = corps.problemeId ? await prisma.probleme.findUnique({ where: { id: corps.problemeId } }) : null;
  if (!tache || tache.bonId !== params.id) return NextResponse.json({ erreur: "Choisis la tâche du bon où mettre la pièce." }, { status: 400 });

  const fournisseur = corps.fournisseurId ? await prisma.fournisseur.findUnique({ where: { id: corps.fournisseurId } }) : null;
  if (!fournisseur || !fournisseur.actif) return NextResponse.json({ erreur: "Choisis un fournisseur." }, { status: 400 });

  // Fiche d'inventaire : le numéro chez ce fournisseur, puis le numéro de la
  // pièce ou un de ses autres numéros, puis le numéro chez un autre fournisseur
  const egal = { equals: numero, mode: "insensitive" };
  const piece =
    (await prisma.pieceFournisseur.findFirst({ where: { fournisseurId: fournisseur.id, numeroFournisseur: egal }, include: { piece: true } }))?.piece ||
    (await prisma.piece.findFirst({ where: { OR: [{ numero: egal }, { autresNumeros: { has: numero } }] } })) ||
    (await prisma.pieceFournisseur.findFirst({ where: { numeroFournisseur: egal }, include: { piece: true } }))?.piece ||
    null;
  if (piece && !piece.actif) {
    return NextResponse.json({ erreur: `Le numéro ${numero} est celui de « ${piece.nom} » (${piece.numero}), désactivée dans l'inventaire — réactive-la d'abord.` }, { status: 409 });
  }

  let pieceCommandee = piece;
  if (!pieceCommandee) {
    const prixVente = Number(String(corps.prixVente ?? "").replace(",", "."));
    if (!(prixVente > 0)) return NextResponse.json({ erreur: "Indique le prix de vente au client de cette nouvelle pièce." }, { status: 400 });
    pieceCommandee = await prisma.piece.create({
      data: { nom: ligne.description, numero, prix: Math.round(prixVente * 100) / 100, coutant: 0, qte: 0, fournisseurId: fournisseur.id },
    });
  }

  // Lien avec ce fournisseur : numéro (s'il n'est pas déjà pris) et prix
  const lien = await prisma.pieceFournisseur.findUnique({ where: { pieceId_fournisseurId: { pieceId: pieceCommandee.id, fournisseurId: fournisseur.id } } });
  const numeroPris = await prisma.pieceFournisseur.findFirst({ where: { fournisseurId: fournisseur.id, numeroFournisseur: egal, NOT: { pieceId: pieceCommandee.id } } });
  if (lien) {
    await prisma.pieceFournisseur.update({
      where: { id: lien.id },
      data: { ...(!lien.numeroFournisseur && !numeroPris && { numeroFournisseur: numero }), ...(cout !== null && { coutant: cout }) },
    });
  } else {
    await prisma.pieceFournisseur.create({
      data: { pieceId: pieceCommandee.id, fournisseurId: fournisseur.id, numeroFournisseur: numeroPris ? null : numero, coutant: cout },
    });
  }

  const commande = await ajouterACommande({
    fournisseurId: fournisseur.id,
    lignes: [{ pieceId: pieceCommandee.id, qte, coutUnitaire: cout ?? undefined, numeroFournisseur: numero }],
    ajouterAuBrouillon: true,
    note: `Pour le bon #${ligne.bon.numero}`,
    creePar: session.nom,
  });

  // Sur le bon tout de suite, en B/O, au prix de vente de la fiche. Une pièce
  // recommandée (commande précédente annulée) reprend sa ligne B/O.
  const prixVente = (await prisma.piece.findUnique({ where: { id: pieceCommandee.id } })).prix;
  const dejaSurBon = ligne.pieceUtiliseeId
    ? await prisma.pieceUtilisee.findUnique({ where: { id: ligne.pieceUtiliseeId } })
    : null;
  const surBon = dejaSurBon?.bo
    ? await prisma.pieceUtilisee.update({ where: { id: dejaSurBon.id }, data: { problemeId: tache.id, pieceId: pieceCommandee.id, qte, prix: prixVente } })
    : await prisma.pieceUtilisee.create({ data: { problemeId: tache.id, pieceId: pieceCommandee.id, qte, prix: prixVente, coutant: null, bo: true } });

  await prisma.pieceACommander.update({
    where: { id: ligne.id },
    data: {
      pieceId: pieceCommandee.id, commandeId: commande.id, pieceUtiliseeId: surBon.id, commandee: true,
      numero, fournisseur: fournisseur.nom, qte, ...(cout !== null && { prix: cout }),
    },
  });
  return NextResponse.json({ ...commande, pieceCreee: !piece, piece: { id: pieceCommandee.id, numero: pieceCommandee.numero, nom: pieceCommandee.nom } });
}
