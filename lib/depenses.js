// Création d'une dépense fournisseur, commune à la saisie manuelle
// (Comptes à payer) et à la réception d'une commande fournisseur.
const { posterDepenseRecue } = require("./comptabilite");

// Ancre une date-seule ("YYYY-MM-DD") à midi UTC — sinon minuit UTC recule
// d'un jour une fois affiché en heure du Québec (voir même correctif sur
// les dates de paie, app/api/paie/lots/route.js).
function jourCivil(dateStr) {
  return new Date(`${dateStr.slice(0, 10)}T12:00:00Z`);
}

// À appeler dans une transaction. `lignes` : [{ categorieDepenseId, montant,
// description, pieceId, qteRecue }], déjà validées.
//
// Réceptions de stock : une ligne peut être liée à une pièce d'inventaire
// avec une quantité reçue — le stock est ajusté tout de suite (pas besoin
// d'attendre que la facture soit marquée payée), avec un coût moyen
// pondéré recalculé à partir du montant de la ligne (avant taxes). Le prix
// payé devient aussi le dernier prix de la pièce chez ce fournisseur.
async function creerDepenseDansTransaction(tx, donnees, nomUtilisateur) {
  const { fournisseurId, description, lignes, tpsPayee, tvqPayee, dateFacture, dateEcheance, commandeFournisseurId } = donnees;
  const tps = Number(tpsPayee) || 0;
  const tvq = Number(tvqPayee) || 0;
  const montantTotal = lignes.reduce((s, l) => s + Number(l.montant), 0) + tps + tvq;
  const dateDeFacture = jourCivil(dateFacture);

  const receptions = lignes
    .map((l) => ({ pieceId: l.pieceId, qteRecue: Number(l.qteRecue) || 0, montant: Number(l.montant) }))
    .filter((r) => r.pieceId && r.qteRecue > 0);

  const fournisseur = receptions.length > 0 ? await tx.fournisseur.findUnique({ where: { id: fournisseurId } }) : null;

  const creee = await tx.depense.create({
    data: {
      fournisseurId,
      description,
      montant: montantTotal,
      tpsPayee: tps,
      tvqPayee: tvq,
      dateFacture: dateDeFacture,
      dateEcheance: dateEcheance ? jourCivil(dateEcheance) : null,
      commandeFournisseurId: commandeFournisseurId || null,
      lignes: {
        create: lignes.map((l) => ({
          categorieDepenseId: l.categorieDepenseId,
          montant: Number(l.montant),
          description: l.description || null,
          pieceId: l.pieceId && Number(l.qteRecue) > 0 ? l.pieceId : null,
          qteRecue: l.pieceId && Number(l.qteRecue) > 0 ? Number(l.qteRecue) : null,
        })),
      },
    },
    include: { lignes: { include: { categorieDepense: true } } },
  });

  for (const reception of receptions) {
    const piece = await tx.piece.findUnique({ where: { id: reception.pieceId } });
    if (!piece) continue;
    const coutUnitaire = reception.montant / reception.qteRecue;
    const nouvelleQte = piece.qte + reception.qteRecue;
    const nouveauCoutant = nouvelleQte > 0
      ? (piece.qte * piece.coutant + reception.qteRecue * coutUnitaire) / nouvelleQte
      : piece.coutant;
    const ligneCorrespondante = creee.lignes.find((l) => l.pieceId === reception.pieceId && l.qteRecue === reception.qteRecue);
    await tx.piece.update({
      where: { id: reception.pieceId },
      data: {
        qte: nouvelleQte,
        coutant: nouveauCoutant,
        mouvements: {
          create: {
            type: "RECEPTION", qte: reception.qteRecue, solde: nouvelleQte,
            note: `Réception — ${fournisseur?.nom || "Facture"} (${description})`, ligneDepenseId: ligneCorrespondante?.id || null, creePar: nomUtilisateur,
          },
        },
      },
    });
    await tx.pieceFournisseur.upsert({
      where: { pieceId_fournisseurId: { pieceId: reception.pieceId, fournisseurId } },
      update: { coutant: coutUnitaire, dernierAchat: dateDeFacture },
      create: { pieceId: reception.pieceId, fournisseurId, coutant: coutUnitaire, dernierAchat: dateDeFacture },
    });
  }

  return creee;
}

// Écriture comptable de la dépense reçue (après la transaction) — un échec
// est journalisé sans annuler la dépense, comme ailleurs dans l'appli.
async function comptabiliserDepenseRecue(depense, nomUtilisateur) {
  try {
    await posterDepenseRecue(
      {
        ...depense,
        lignesPourEcriture: depense.lignes.map((l) => ({
          compteDepenseNumero: l.categorieDepense.compteDepenseNumero,
          montant: l.montant,
          description: l.description,
        })),
      },
      nomUtilisateur
    );
  } catch (e) {
    console.error("Erreur comptabilisation dépense :", e);
  }
}

module.exports = { jourCivil, creerDepenseDansTransaction, comptabiliserDepenseRecue };
