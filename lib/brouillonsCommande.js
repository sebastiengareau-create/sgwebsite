// Ajout de pièces à une commande fournisseur, côté serveur : dans une
// commande précise (commandeId), dans le brouillon déjà ouvert chez ce
// fournisseur (ajouterAuBrouillon), sinon dans une nouvelle commande.
// Partagé par « Commander chez … » (fiche d'une pièce,
// app/api/commandes-fournisseurs), « 🛒 Commander » d'une pièce à commander
// d'un bon et la recherche de pièces des commandes. Séparé de lib/commandesFournisseurs.js, qui sert aussi au
// navigateur : ce module charge Prisma.
const { prisma } = require("./prisma");
const { creerAvecNumero, prochainNumeroCommandeFournisseur } = require("./numerotation");

// lignes : [{ pieceId, qte, coutUnitaire?, numeroFournisseur? }]. Prix prévu :
// celui donné, sinon le dernier payé chez ce fournisseur, sinon le coût moyen
// de la pièce ; numéro : celui donné, sinon celui connu chez ce fournisseur.
// → { id, numero, ajouteeAuBrouillon }
async function ajouterACommande({ fournisseurId, lignes, ajouterAuBrouillon, commandeId, note, creePar }) {
  const lignesValides = lignes.filter((l) => l.pieceId && Math.floor(Number(l.qte)) > 0);
  const [pieces, liens] = await Promise.all([
    prisma.piece.findMany({ where: { id: { in: lignesValides.map((l) => l.pieceId) } } }),
    prisma.pieceFournisseur.findMany({ where: { fournisseurId, pieceId: { in: lignesValides.map((l) => l.pieceId) } } }),
  ]);
  const pieceParId = new Map(pieces.map((p) => [p.id, p]));
  const lienParPiece = new Map(liens.map((l) => [l.pieceId, l]));

  const nouvellesLignes = lignesValides.filter((l) => pieceParId.has(l.pieceId)).map((l) => {
    const lien = lienParPiece.get(l.pieceId);
    const cout = l.coutUnitaire !== undefined && l.coutUnitaire !== null && l.coutUnitaire !== ""
      ? Number(l.coutUnitaire)
      : (lien?.coutant ?? pieceParId.get(l.pieceId).coutant);
    return {
      pieceId: l.pieceId,
      qteCommandee: Math.floor(Number(l.qte)),
      coutUnitaire: cout || 0,
      numeroFournisseur: l.numeroFournisseur?.trim() || lien?.numeroFournisseur || null,
    };
  });

  const brouillon = commandeId
    ? await prisma.commandeFournisseur.findUnique({ where: { id: commandeId }, include: { lignes: true } })
    : ajouterAuBrouillon
      ? await prisma.commandeFournisseur.findFirst({ where: { fournisseurId, statut: "BROUILLON" }, orderBy: { creeLe: "desc" }, include: { lignes: true } })
      : null;

  if (brouillon) {
    await prisma.$transaction(async (tx) => {
      for (const l of nouvellesLignes) {
        const existante = brouillon.lignes.find((x) => x.pieceId === l.pieceId);
        if (existante) {
          await tx.ligneCommandeFournisseur.update({ where: { id: existante.id }, data: { qteCommandee: existante.qteCommandee + l.qteCommandee } });
        } else {
          await tx.ligneCommandeFournisseur.create({ data: { ...l, commandeId: brouillon.id } });
        }
      }
    });
    return { id: brouillon.id, numero: brouillon.numero, ajouteeAuBrouillon: true };
  }

  const commande = await creerAvecNumero(prochainNumeroCommandeFournisseur, (numero) =>
    prisma.commandeFournisseur.create({
      data: { numero, fournisseurId, note: note || null, creePar, lignes: { create: nouvellesLignes } },
    })
  );
  return { id: commande.id, numero: commande.numero, ajouteeAuBrouillon: false };
}

// Pièce trouvée chez un fournisseur (recherche de pièces) → sa fiche
// d'inventaire : le numéro chez ce fournisseur, puis le numéro de la pièce ou
// un de ses autres numéros, puis le numéro chez un autre fournisseur (même
// ordre que pieceExistante de lib/recherchePieces.js, côté navigateur). Sans
// fiche, elle est créée (quantité 0, au prix de vente donné). Le lien avec ce
// fournisseur garde son numéro (s'il n'est pas déjà pris) et son prix.
// → { piece, creee } ou { erreur, status }
async function pieceDepuisRecherche({ fournisseurId, numero, nom, cout, prixVente }) {
  const egal = { equals: numero, mode: "insensitive" };
  const piece =
    (await prisma.pieceFournisseur.findFirst({ where: { fournisseurId, numeroFournisseur: egal }, include: { piece: true } }))?.piece ||
    (await prisma.piece.findFirst({ where: { OR: [{ numero: egal }, { autresNumeros: { has: numero } }] } })) ||
    (await prisma.pieceFournisseur.findFirst({ where: { numeroFournisseur: egal }, include: { piece: true } }))?.piece ||
    null;
  if (piece && !piece.actif) {
    return { erreur: `Le numéro ${numero} est celui de « ${piece.nom} » (${piece.numero}), désactivée dans l'inventaire — réactive-la d'abord.`, status: 409 };
  }

  let trouvee = piece;
  if (!trouvee) {
    const vente = Number(String(prixVente ?? "").replace(",", "."));
    if (!(vente > 0)) return { erreur: "Indique le prix de vente au client de cette nouvelle pièce.", status: 400 };
    trouvee = await prisma.piece.create({
      data: { nom: String(nom || "").trim().slice(0, 150) || numero, numero, prix: Math.round(vente * 100) / 100, coutant: 0, qte: 0, fournisseurId },
    });
  }

  const lien = await prisma.pieceFournisseur.findUnique({ where: { pieceId_fournisseurId: { pieceId: trouvee.id, fournisseurId } } });
  const numeroPris = await prisma.pieceFournisseur.findFirst({ where: { fournisseurId, numeroFournisseur: egal, NOT: { pieceId: trouvee.id } } });
  if (lien) {
    await prisma.pieceFournisseur.update({
      where: { id: lien.id },
      data: { ...(!lien.numeroFournisseur && !numeroPris && { numeroFournisseur: numero }), ...(cout !== null && { coutant: cout }) },
    });
  } else {
    await prisma.pieceFournisseur.create({
      data: { pieceId: trouvee.id, fournisseurId, numeroFournisseur: numeroPris ? null : numero, coutant: cout },
    });
  }
  return { piece: trouvee, creee: !piece };
}

// À la réception d'une commande (dans sa transaction, après l'entrée en
// stock) : les pièces B/O des bons qui attendaient cette commande sortent du
// stock comme une pièce ajoutée normalement à un bon — mouvement de vente et
// coût unitaire figé — et ne sont plus B/O. Une pièce reçue en partie seulement
// (stock insuffisant) reste B/O jusqu'à la réception du reste.
async function sortirPiecesBoRecues(tx, commandeId, creePar) {
  const enAttente = await tx.pieceACommander.findMany({
    where: { commandeId, pieceUtilisee: { is: { bo: true } } },
    include: { pieceUtilisee: true, bon: { include: { client: true } } },
  });
  for (const a of enAttente) {
    const ligne = a.pieceUtilisee;
    const piece = await tx.piece.findUnique({ where: { id: ligne.pieceId } });
    if (!piece || piece.qte < ligne.qte) continue;
    const nouvelleQte = piece.qte - ligne.qte;
    await tx.piece.update({
      where: { id: piece.id },
      data: {
        qte: nouvelleQte,
        mouvements: {
          create: {
            type: "VENTE", qte: -ligne.qte, solde: nouvelleQte,
            note: `Bon #${a.bon.numero} — ${a.bon.client.nom} (B/O reçue)`, creePar,
          },
        },
      },
    });
    await tx.pieceUtilisee.update({ where: { id: ligne.id }, data: { bo: false, coutant: piece.coutant } });
  }
}

module.exports = { ajouterACommande, pieceDepuisRecherche, sortirPiecesBoRecues };
