const { prisma } = require("./prisma");
const { trouverDoublonsClient } = require("./clients");
const { ajusterKitSurBon, coutMoyenApresRetour } = require("./kits");

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

// Remet en stock ce qu'une ligne de pièce du bon en avait sorti, avant que
// la ligne disparaisse (pièce retirée, tâche ou bon supprimé) : au coût figé
// sur la ligne, avec un mouvement au journal. B/O : jamais sortie du stock,
// rien à remettre. Kit : chacune de ses pièces revient (lib/kits.js).
async function remettreLigneEnStock(tx, ligne, { note, creePar }) {
  if (ligne.bo) return;
  if (ligne.kit) {
    await ajusterKitSurBon(tx, ligne, 0, { creePar, note: `${note} (kit)` });
    return;
  }
  const piece = await tx.piece.findUnique({ where: { id: ligne.pieceId } });
  const nouvelleQte = piece.qte + ligne.qte;
  await tx.piece.update({
    where: { id: ligne.pieceId },
    data: {
      qte: nouvelleQte,
      coutant: coutMoyenApresRetour(piece, ligne.qte, ligne.coutant ?? piece.coutant),
      mouvements: { create: { type: "VENTE", qte: ligne.qte, solde: nouvelleQte, note, creePar } },
    },
  });
}

// Bons pas encore facturés du client (avertissement à la création d'un bon,
// profil avertirBonNonFacture — voir lib/bonsNonFactures.js). Cherche aussi
// dans les dossiers semblables (même nom, téléphone ou courriel) : un
// rendez-vous transformé en bon sans client du dossier en crée un nouveau.
// Sans clientId (rendez-vous, soumission sans dossier) : par nom, téléphone
// et courriel seulement.
async function trouverBonsNonFactures({ clientId, nom, telephone, courriel }) {
  const client = clientId
    ? await prisma.client.findUnique({ where: { id: clientId }, select: { nom: true, telephone: true, courriel: true } })
    : null;
  const semblables = await trouverDoublonsClient(client || { nom, telephone, courriel }, clientId);
  const ids = [clientId, ...semblables.map((c) => c.id)].filter(Boolean);
  if (ids.length === 0) return [];
  return prisma.bonTravail.findMany({
    where: { clientId: { in: ids }, facture: null },
    orderBy: { creeLe: "asc" },
    select: { id: true, numero: true, statut: true, datePrevue: true, client: { select: { id: true, nom: true, numero: true } } },
  });
}

module.exports = { bonEstVerrouille, trouverBonsNonFactures, sortirDuStockPourBon, remettreLigneEnStock, MESSAGE_BON_VERROUILLE, passerBonEnCoursSiEnAttente, remettreBonEnAttenteSiSansTemps };
