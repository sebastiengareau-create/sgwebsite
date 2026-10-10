import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { verifierPeriodeModifiable, assurerCategorieInventairePieces } from "@/lib/comptabilite";
import { jourCivil, creerDepenseDansTransaction, comptabiliserDepenseRecue } from "@/lib/depenses";
import { resteARecevoir } from "@/lib/commandesFournisseurs";
import { sortirPiecesBoRecues } from "@/lib/brouillonsCommande";
import { notifier, employesDuBon } from "@/lib/notifications";

const arrondi = (n) => Math.round(n * 100) / 100;

// Réception de marchandise (complète ou partielle) avec la facture du
// fournisseur : crée la dépense à payer, entre le stock au prix réel (coût
// moyen pondéré) et met à jour le dernier prix chez ce fournisseur.
// lignes : [{ ligneId, qte, coutUnitaire }] — prix réel avant taxes.
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { lignes = [], numeroFacture, dateFacture, dateEcheance, tpsPayee, tvqPayee } = await request.json();
  const commande = await prisma.commandeFournisseur.findUnique({
    where: { id: params.id },
    include: { lignes: { include: { piece: true } } },
  });
  if (!commande) return NextResponse.json({ erreur: "Commande introuvable." }, { status: 404 });
  if (!["BROUILLON", "ENVOYEE", "RECUE_PARTIELLE"].includes(commande.statut)) {
    return NextResponse.json({ erreur: "Cette commande est close ou annulée." }, { status: 409 });
  }
  if (!dateFacture) return NextResponse.json({ erreur: "Date de la facture requise." }, { status: 400 });

  const recues = lignes
    .map((l) => ({ ligne: commande.lignes.find((x) => x.id === l.ligneId), qte: Math.floor(Number(l.qte)) || 0, cout: Number(l.coutUnitaire) }))
    .filter((r) => r.ligne && r.qte > 0);
  if (recues.length === 0) return NextResponse.json({ erreur: "Indique au moins une quantité reçue." }, { status: 400 });
  if (recues.some((r) => !(r.cout >= 0))) return NextResponse.json({ erreur: "Prix unitaire invalide." }, { status: 400 });

  try {
    await verifierPeriodeModifiable(jourCivil(dateFacture), { nouvellePiece: true });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  const categorie = await assurerCategorieInventairePieces();
  const description = `Commande ${commande.numero}${numeroFacture?.trim() ? ` — facture ${numeroFacture.trim()}` : ""}`;

  const depense = await prisma.$transaction(async (tx) => {
    const creee = await creerDepenseDansTransaction(tx, {
      fournisseurId: commande.fournisseurId,
      description,
      tpsPayee, tvqPayee, dateFacture, dateEcheance,
      commandeFournisseurId: commande.id,
      lignes: recues.map((r) => ({
        categorieDepenseId: categorie.id,
        montant: arrondi(r.qte * r.cout),
        description: `${r.ligne.piece.numero} — ${r.ligne.piece.nom} × ${r.qte}`,
        pieceId: r.ligne.pieceId,
        qteRecue: r.qte,
      })),
    }, session.nom);

    for (const r of recues) {
      await tx.ligneCommandeFournisseur.update({ where: { id: r.ligne.id }, data: { qteRecue: r.ligne.qteRecue + r.qte } });
      // Le numéro de la pièce chez ce fournisseur, s'il a été saisi sur la
      // commande, est retenu pour les prochaines — sauf s'il est déjà celui
      // d'une autre pièce (doublon à régler à la main).
      if (r.ligne.numeroFournisseur) {
        const pris = await tx.pieceFournisseur.findFirst({
          where: { fournisseurId: commande.fournisseurId, numeroFournisseur: r.ligne.numeroFournisseur },
        });
        if (!pris) {
          await tx.pieceFournisseur.updateMany({
            where: { fournisseurId: commande.fournisseurId, pieceId: r.ligne.pieceId, numeroFournisseur: null },
            data: { numeroFournisseur: r.ligne.numeroFournisseur },
          });
        }
      }
    }

    const qteRecueApres = new Map(recues.map((r) => [r.ligne.id, r.ligne.qteRecue + r.qte]));
    const toutRecu = commande.lignes.every((l) => resteARecevoir({ ...l, qteRecue: qteRecueApres.get(l.id) ?? l.qteRecue }) === 0);
    await tx.commandeFournisseur.update({
      where: { id: commande.id },
      data: { statut: toutRecu ? "RECUE" : "RECUE_PARTIELLE", ...(!commande.dateEnvoi && { dateEnvoi: new Date() }) },
    });
    // Pièces B/O des bons qui attendaient cette commande : sortent du stock
    await sortirPiecesBoRecues(tx, commande.id, session.nom);
    return creee;
  });

  await comptabiliserDepenseRecue(depense, session.nom);
  after(() => aviserPiecesRecues(commande, recues.map((r) => r.ligne.pieceId), session.id));
  return NextResponse.json({ depenseId: depense.id, montant: depense.montant });
}

// Bons qui attendaient des pièces de cette réception : leurs employés
// sont avisés, un avis par bon
async function aviserPiecesRecues(commande, pieceIds, auteurId) {
  const enAttente = await prisma.pieceACommander.findMany({
    where: { commandeId: commande.id, pieceId: { in: pieceIds } },
    include: { bon: { select: { id: true, numero: true, client: { select: { nom: true } } } } },
  });
  const parBon = new Map();
  for (const a of enAttente) {
    if (!parBon.has(a.bonId)) parBon.set(a.bonId, { bon: a.bon, pieces: [] });
    parBon.get(a.bonId).pieces.push(a.description);
  }
  for (const { bon, pieces } of parBon.values()) {
    await notifier("PIECES_RECUES", {
      employeIds: await employesDuBon(bon.id),
      sauf: [auteurId],
      titre: `📦 Pièces reçues — bon #${bon.numero}`,
      corps: `${bon.client.nom} · ${pieces.join(", ")}`,
      url: `/bons/${bon.id}`,
      tag: `pieces-${bon.id}`,
    });
  }
}
