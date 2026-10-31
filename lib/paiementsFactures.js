// Encaissement des factures : une facture se paie en un ou plusieurs
// paiements (PaiementFacture), chacun avec son montant, son mode et son
// compte de trésorerie — ex. 1000 $ comptant + 3500 $ par virement, et le
// solde de 1200 $ par chèque plus tard. La facture reste « Impayée » tant
// qu'il reste un solde, et passe à « Payée » quand il tombe à 0.
//
// Facture.montantPaye garde la somme des paiements (pour les totaux impayés
// sans relire chaque paiement) ; il est toujours recalculé depuis les
// paiements eux-mêmes (recalculerFacture), jamais incrémenté à la main.
const { prisma } = require("./prisma");
const { posterPaiementFacture, verifierPeriodeModifiable } = require("./comptabilite");
const { MODES_PAIEMENT } = require("./modesPaiement");

const arrondir = (n) => Math.round(n * 100) / 100;
const MODES_VALIDES = MODES_PAIEMENT.map((m) => m.valeur);

// Solde encore dû — 0 pour une facture payée ou annulée (y compris celles
// payées par le coûtant d'un véhicule à vendre, qui n'ont pas de paiement)
function soldeFacture(f) {
  if (f.statut !== "IMPAYEE") return 0;
  return Math.max(0, arrondir(f.totalAvecTaxes - (f.montantPaye || 0)));
}

// Remet montantPaye, le statut et le résumé du paiement (mode, compte,
// références, date) d'accord avec les paiements de la facture.
async function recalculerFacture(tx, factureId) {
  const f = await tx.facture.findUnique({ where: { id: factureId }, include: { paiements: { orderBy: { datePaiement: "asc" } } } });
  const montantPaye = arrondir(f.paiements.reduce((s, p) => s + p.montant, 0));
  const payee = f.paiements.length > 0 && montantPaye >= arrondir(f.totalAvecTaxes) - 0.005;
  if (!payee) {
    return tx.facture.update({
      where: { id: factureId },
      data: { montantPaye, statut: "IMPAYEE", datePaiement: null, compteTresorerieId: null, modePaiement: null, referenceVersement: null },
    });
  }
  const dernier = f.paiements.at(-1);
  const modes = new Set(f.paiements.map((p) => p.modePaiement));
  const references = f.paiements.map((p) => p.reference).filter(Boolean);
  return tx.facture.update({
    where: { id: factureId },
    data: {
      montantPaye, statut: "PAYEE",
      datePaiement: dernier.datePaiement,
      compteTresorerieId: dernier.compteTresorerieId,
      modePaiement: modes.size === 1 ? dernier.modePaiement : "MULTIPLE",
      referenceVersement: references.length ? references.join(", ") : null,
    },
  });
}

// Enregistre un ou plusieurs paiements sur une facture impayée.
// lignes : [{ montant, modePaiement, compteTresorerieId, reference }]
// Leur total ne peut pas dépasser le solde ; s'il est plus petit, la facture
// reste impayée avec le solde restant. Chaque paiement est comptabilisé ; une
// période verrouillée n'empêche pas l'encaissement mais est rapportée dans
// avertissementComptable (même comportement qu'avant les paiements multiples).
async function enregistrerPaiements(factureId, lignes, { creePar = null, date = new Date() } = {}) {
  if (!Array.isArray(lignes) || lignes.length === 0) throw new Error("Ajoute au moins un paiement.");
  const paiementsDemandes = lignes.map((l) => ({
    montant: arrondir(Number(l.montant)),
    modePaiement: l.modePaiement || null,
    compteTresorerieId: l.compteTresorerieId,
    reference: String(l.reference || "").trim() || null,
  }));
  for (const p of paiementsDemandes) {
    if (!Number.isFinite(p.montant) || p.montant < 0) throw new Error("Montant de paiement invalide.");
    if (p.modePaiement && !MODES_VALIDES.includes(p.modePaiement)) throw new Error("Mode de paiement invalide.");
    if (!p.compteTresorerieId) throw new Error("Choisis un compte pour chaque paiement.");
  }
  const idsComptes = [...new Set(paiementsDemandes.map((p) => p.compteTresorerieId))];
  const comptes = await prisma.compteTresorerie.findMany({ where: { id: { in: idsComptes } }, include: { compte: true } });
  if (comptes.length !== idsComptes.length) throw new Error("Compte introuvable.");
  const compteGl = Object.fromEntries(comptes.map((c) => [c.id, c.compte.numero]));

  const { MODE_PAIEMENT_COUTANT } = require("./vehiculesAVendre");
  const { facture, paiements } = await prisma.$transaction(async (tx) => {
    const avant = await tx.facture.findUnique({ where: { id: factureId } });
    if (!avant) throw new Error("Facture introuvable.");
    if (avant.modePaiement === MODE_PAIEMENT_COUTANT) throw new Error("Cette facture est payée par le coûtant du véhicule à vendre.");
    if (avant.statut !== "IMPAYEE") throw new Error("Cette facture n'est plus impayée.");
    const solde = soldeFacture(avant);
    const total = arrondir(paiementsDemandes.reduce((s, p) => s + p.montant, 0));
    if (total > solde + 0.005) {
      throw new Error(`Les paiements (${total.toFixed(2)} $) dépassent le solde de la facture (${solde.toFixed(2)} $).`);
    }
    // Un paiement à 0 $ ne sert qu'à fermer une facture déjà à 0 $
    const retenus = paiementsDemandes.filter((p) => p.montant > 0 || solde === 0).slice(0, solde === 0 ? 1 : undefined);
    if (retenus.length === 0) throw new Error("Entre le montant reçu.");
    const crees = [];
    for (const p of retenus) {
      crees.push(await tx.paiementFacture.create({ data: { ...p, factureId, datePaiement: date, creePar } }));
    }
    return { facture: await recalculerFacture(tx, factureId), paiements: crees };
  });

  let avertissementComptable = null;
  for (const p of paiements) {
    if (p.montant <= 0) continue;
    try {
      const ecriture = await posterPaiementFacture(facture, p, creePar, compteGl[p.compteTresorerieId]);
      if (ecriture) p.ecritureId = (await prisma.paiementFacture.update({ where: { id: p.id }, data: { ecritureId: ecriture.id } })).ecritureId;
    } catch (e) {
      if (e.message.startsWith("PERIODE_LOCK:")) {
        avertissementComptable = e.message.replace("PERIODE_LOCK:", "").split("\n")[0];
      } else {
        console.error("Erreur comptabilisation paiement de facture :", e);
      }
    }
  }
  return { facture, paiements, avertissementComptable };
}

// Retire un paiement et son écriture ; la facture redevient impayée avec le
// solde correspondant. Refusé si l'écriture est déjà reliée à une
// transaction bancaire ou à une conciliation (ignorerBanque : appelé par
// l'annulation de l'examen bancaire elle-même, qui détache la transaction).
async function retirerPaiement(paiementId, { ignorerBanque = false } = {}) {
  const p = await prisma.paiementFacture.findUnique({ where: { id: paiementId } });
  if (!p) throw new Error("Paiement introuvable.");
  if (p.ecritureId) {
    const lignes = await prisma.ligneEcriture.findMany({ where: { ecritureId: p.ecritureId } });
    if (lignes.some((l) => l.rapprochementId)) {
      throw new Error("Ce paiement fait partie d'une conciliation bancaire enregistrée — annule d'abord la conciliation.");
    }
    if (!ignorerBanque && lignes.some((l) => l.transactionBancaireId)) {
      throw new Error("Ce paiement est associé à une transaction bancaire — annule d'abord son examen (Comptabilité → Transactions bancaires).");
    }
    await verifierPeriodeModifiable(p.datePaiement, { nouvellePiece: false });
  }
  return prisma.$transaction(async (tx) => {
    if (p.ecritureId) await tx.ecritureComptable.deleteMany({ where: { id: p.ecritureId } });
    await tx.paiementFacture.delete({ where: { id: p.id } });
    return recalculerFacture(tx, p.factureId);
  });
}

// « Marquer impayée » : retire tous les paiements de la facture
async function retirerPaiements(factureId) {
  const paiements = await prisma.paiementFacture.findMany({ where: { factureId }, orderBy: { datePaiement: "desc" } });
  for (const p of paiements) await retirerPaiement(p.id);
  // Facture payée sans paiement enregistré (ancienne, avant les paiements
  // multiples) : seulement remise impayée, comme avant
  return prisma.$transaction((tx) => recalculerFacture(tx, factureId));
}

module.exports = { soldeFacture, enregistrerPaiements, retirerPaiement, retirerPaiements };
