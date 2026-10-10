import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { ajouterACommande, pieceDepuisRecherche } from "@/lib/brouillonsCommande";
import { bonEstVerrouille, MESSAGE_BON_VERROUILLE } from "@/lib/bons";

// « 🛒 Commander » une pièce à commander d'un bon : trouve sa fiche
// d'inventaire (par le numéro, chez ce fournisseur ou ailleurs) ou la crée
// (quantité 0) — pieceDepuisRecherche, lib/brouillonsCommande.js —,
// l'ajoute au brouillon de commande de ce fournisseur, et l'ajoute tout de suite à une tâche du bon en B/O : elle compte dans le
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

  const trouvee = await pieceDepuisRecherche({ fournisseurId: fournisseur.id, numero, nom: ligne.description, cout, prixVente: corps.prixVente });
  if (trouvee.erreur) return NextResponse.json({ erreur: trouvee.erreur }, { status: trouvee.status });
  const pieceCommandee = trouvee.piece;

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
  return NextResponse.json({ ...commande, pieceCreee: trouvee.creee, piece: { id: pieceCommandee.id, numero: pieceCommandee.numero, nom: pieceCommandee.nom } });
}
