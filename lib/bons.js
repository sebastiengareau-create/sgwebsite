const { prisma } = require("./prisma");

// Un bon facturé est figé — plus aucune modification de ses tâches, pièces,
// temps, photos ou escompte. La seule façon de le débloquer est d'annuler
// la facture (bouton réservé au gérant), qui remet le bon "En cours".
async function bonEstVerrouille(bonId) {
  const facture = await prisma.facture.findUnique({ where: { bonId }, select: { id: true } });
  return !!facture;
}

const MESSAGE_BON_VERROUILLE = "Ce bon est facturé et ne peut plus être modifié — annule la facture d'abord si une correction est nécessaire.";

// Le bon passe automatiquement "En cours" dès que du temps lui est attribué
// (poinçon démarré ou temps saisi manuellement), s'il était encore "En attente".
async function passerBonEnCoursSiEnAttente(bonId) {
  await prisma.bonTravail.updateMany({ where: { id: bonId, statut: "EN_ATTENTE" }, data: { statut: "EN_COURS" } });
}

// À l'inverse, un bon "En cours" revient "En attente" quand on supprime sa
// dernière entrée de temps (plus aucune main-d'œuvre sur aucune tâche).
async function remettreBonEnAttenteSiSansTemps(bonId) {
  const resteDuTemps = await prisma.entreeTemps.count({ where: { probleme: { bonId } } });
  if (resteDuTemps > 0) return;
  await prisma.bonTravail.updateMany({ where: { id: bonId, statut: "EN_COURS" }, data: { statut: "EN_ATTENTE" } });
}

// Sort `quantite` d'une pièce du stock vers une tâche du bon (dans la
// transaction tx) : mouvement de vente, et ligne de la tâche au prix de vente.
// Le coût unitaire est figé à la sortie du stock : c'est lui que la facture
// passera en coût des pièces vendues, même si le coût moyen de la pièce change
// d'ici là (sinon inventaire et grand livre divergent). Une ligne B/O de la
// même pièce reste à part : elle n'est pas sortie du stock.
// probleme doit inclure bon.client ; piece est la fiche lue dans tx.
async function sortirDuStockPourBon(tx, { probleme, piece, quantite, creePar }) {
  if (piece.qte < quantite) throw new Error("STOCK_INSUFFISANT");
  const nouvelleQte = piece.qte - quantite;
  await tx.piece.update({
    where: { id: piece.id },
    data: {
      qte: nouvelleQte,
      mouvements: {
        create: {
          type: "VENTE", qte: -quantite, solde: nouvelleQte,
          note: `Bon #${probleme.bon.numero} — ${probleme.bon.client.nom}`, creePar,
        },
      },
    },
  });

  const existante = await tx.pieceUtilisee.findFirst({ where: { problemeId: probleme.id, pieceId: piece.id, bo: false } });
  if (existante) {
    const qteTotale = existante.qte + quantite;
    const coutant = (existante.qte * (existante.coutant ?? piece.coutant) + quantite * piece.coutant) / qteTotale;
    return tx.pieceUtilisee.update({ where: { id: existante.id }, data: { qte: qteTotale, coutant } });
  }
  return tx.pieceUtilisee.create({
    data: { problemeId: probleme.id, pieceId: piece.id, qte: quantite, prix: piece.prix, coutant: piece.coutant },
  });
}

module.exports = { bonEstVerrouille, sortirDuStockPourBon, MESSAGE_BON_VERROUILLE, passerBonEnCoursSiEnAttente, remettreBonEnAttenteSiSansTemps };
