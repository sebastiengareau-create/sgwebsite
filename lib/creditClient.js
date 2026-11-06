// Crédit client : argent qui appartient au client, gardé pour plus tard.
// Un mouvement par ligne (CreditClient) ; le solde du client est la somme
// des montants. Aucune expiration.
//
// D'où vient le crédit (+) :
// - TROP_PAYE : le client a payé plus que le solde d'une facture — le
//   formulaire d'encaissement garde l'excédent (enregistrerPaiements,
//   lib/paiementsFactures.js, option excedentEnCredit) ;
// - DEPOT : un dépôt plus grand que la facture, son excédent passé au crédit
//   au lieu d'être remboursé (transfererExcedentDepot).
// Où il va (−) :
// - APPLIQUE : utilisé sur une facture, comme un paiement (appliquerCredit) —
//   ✕ sur ce paiement le remet au crédit ;
// - REMBOURSE : rendu au client (rembourserCredit).
//
// Comptabilité — passif 2410 « Crédits de clients » :
// - trop-payé : débit trésorerie / crédit 2410 ;
// - excédent de dépôt : débit 2400 / crédit 2410 ;
// - appliqué : débit 2410 / crédit 1100 (source FACTURE_PAYEE, sur le
//   paiement : supprimée avec lui ou avec la facture) ;
// - remboursé : débit 2410 / crédit trésorerie.
const { prisma } = require("./prisma");
const { moduleComptabiliteActif, assurerPlanComptable, creerManquants, enregistrerEcriture, verifierPeriodeModifiable } = require("./comptabilite");
const { MODES_PAIEMENT, LABEL_MODE_PAIEMENT } = require("./modesPaiement");

const COMPTE_CREDITS = "2410"; // à côté du 2400 « Dépôts de clients »
const MODE_CREDIT_CLIENT = "CREDIT_CLIENT"; // modePaiement d'un PaiementFacture payé par le crédit
const arrondir = (n) => Math.round(n * 100) / 100;
const MODES_VALIDES = MODES_PAIEMENT.map((m) => m.valeur);

const LABEL_TYPE_CREDIT = {
  TROP_PAYE: "Trop-payé",
  DEPOT: "Excédent de dépôt",
  APPLIQUE: "Appliqué sur une facture",
  REMBOURSE: "Remboursé",
};

async function assurerCompteCredits() {
  await assurerPlanComptable();
  await creerManquants("compte", "numero", [{ numero: COMPTE_CREDITS, nom: "Crédits de clients", type: "PASSIF" }]);
}

// Période verrouillée → avertissement (le mouvement reste enregistré, comme
// un paiement de facture) ; autre erreur → journal seulement
function avertissementPour(e, contexte) {
  if (e.message?.startsWith("PERIODE_LOCK:")) return e.message.replace("PERIODE_LOCK:", "").split("\n")[0];
  console.error(`Erreur comptabilisation ${contexte} :`, e);
  return null;
}

async function soldeCredit(clientId, db = prisma) {
  const r = await db.creditClient.aggregate({ where: { clientId }, _sum: { montant: true } });
  return arrondir(r._sum.montant || 0);
}

// Soldes de plusieurs clients d'un coup : { clientId: solde } (sans les 0)
async function soldesCredits(clientIds) {
  if (clientIds.length === 0) return {};
  const groupes = await prisma.creditClient.groupBy({ by: ["clientId"], where: { clientId: { in: clientIds } }, _sum: { montant: true } });
  return Object.fromEntries(groupes.map((g) => [g.clientId, arrondir(g._sum.montant || 0)]).filter(([, s]) => Math.abs(s) > 0.005));
}

async function nomClient(clientId) {
  return (await prisma.client.findUnique({ where: { id: clientId }, select: { nom: true } }))?.nom || "";
}

// Écriture d'un mouvement entrant ou sortant d'argent (TROP_PAYE, REMBOURSE,
// DEPOT) ; garde son id sur le mouvement. Retourne un avertissement ou null.
async function comptabiliserMouvement(credit, { description, debit, creditCompte, creePar }) {
  if (!(await moduleComptabiliteActif())) return null;
  try {
    await assurerCompteCredits();
    const montant = Math.abs(credit.montant);
    const ecriture = await enregistrerEcriture({
      date: credit.date,
      description,
      source: "CREDIT_CLIENT",
      sourceId: credit.id,
      lignes: [
        { compteNumero: debit, debit: montant, description },
        { compteNumero: creditCompte, credit: montant, description },
      ],
      creePar,
    });
    await prisma.creditClient.update({ where: { id: credit.id }, data: { ecritureId: ecriture.id } });
    return null;
  } catch (e) {
    return avertissementPour(e, "crédit client");
  }
}

function suffixePaiement(c) {
  const mode = c.modePaiement && LABEL_MODE_PAIEMENT[c.modePaiement] ? ` — ${LABEL_MODE_PAIEMENT[c.modePaiement]}` : "";
  return `${mode}${c.reference ? ` (réf. ${c.reference})` : ""}`;
}

// Écritures des trop-payés créés par enregistrerPaiements (déjà en base) —
// compteGl : { compteTresorerieId: numéro du compte GL }
async function comptabiliserTropPayes(credits, facture, compteGl, creePar) {
  let avertissement = null;
  for (const c of credits) {
    const client = await nomClient(c.clientId);
    const description = `Facture ${facture.numero} — trop-payé gardé en crédit${client ? ` — ${client}` : ""}${suffixePaiement(c)}`;
    avertissement = (await comptabiliserMouvement(c, { description, debit: compteGl[c.compteTresorerieId], creditCompte: COMPTE_CREDITS, creePar })) || avertissement;
  }
  return avertissement;
}

// Applique le crédit du client de la facture, jusqu'au solde (ou montant
// demandé, s'il est plus petit) : un paiement « Crédit client » sans compte
// de trésorerie, et un mouvement APPLIQUE qui le suit (✕ sur le paiement le
// supprime et remet le crédit).
async function appliquerCredit(factureId, { montant = null, creePar = null } = {}) {
  const { soldeFacture, recalculerFacture } = require("./paiementsFactures");
  const { MODE_PAIEMENT_COUTANT } = require("./vehiculesAVendre");
  const resultat = await prisma.$transaction(async (tx) => {
    const facture = await tx.facture.findUnique({ where: { id: factureId }, include: { bon: { select: { clientId: true } } } });
    if (!facture) throw new Error("Facture introuvable.");
    if (facture.statut !== "IMPAYEE" || facture.modePaiement === MODE_PAIEMENT_COUTANT) throw new Error("Cette facture n'est plus impayée.");
    const disponible = await soldeCredit(facture.bon.clientId, tx);
    if (disponible <= 0.005) throw new Error("Ce client n'a pas de crédit.");
    let aAppliquer = arrondir(Math.min(disponible, soldeFacture(facture)));
    if (montant != null) {
      const demande = arrondir(Number(montant));
      if (!Number.isFinite(demande) || demande <= 0) throw new Error("Montant invalide.");
      if (demande > aAppliquer + 0.005) throw new Error(`Maximum : ${aAppliquer.toFixed(2)} $.`);
      aAppliquer = demande;
    }
    if (aAppliquer <= 0.005) throw new Error("Rien à appliquer : la facture n'a plus de solde.");
    const date = new Date();
    const paiement = await tx.paiementFacture.create({
      data: { factureId, montant: aAppliquer, modePaiement: MODE_CREDIT_CLIENT, compteTresorerieId: null, datePaiement: date, creePar },
    });
    await tx.creditClient.create({
      data: { clientId: facture.bon.clientId, type: "APPLIQUE", montant: -aAppliquer, factureId, paiementFactureId: paiement.id, date, creePar },
    });
    return { facture: await recalculerFacture(tx, factureId), paiement };
  });

  let avertissementComptable = null;
  if (await moduleComptabiliteActif()) {
    try {
      await assurerCompteCredits();
      const description = `Facture ${resultat.facture.numero} — crédit client appliqué`;
      const ecriture = await enregistrerEcriture({
        date: resultat.paiement.datePaiement,
        description,
        source: "FACTURE_PAYEE", // comme les autres paiements : supprimée avec la facture
        sourceId: factureId,
        lignes: [
          { compteNumero: COMPTE_CREDITS, debit: resultat.paiement.montant, description },
          { compteNumero: "1100", credit: resultat.paiement.montant, description },
        ],
        creePar,
      });
      await prisma.paiementFacture.update({ where: { id: resultat.paiement.id }, data: { ecritureId: ecriture.id } });
    } catch (e) {
      avertissementComptable = avertissementPour(e, "crédit appliqué");
    }
  }
  return { facture: resultat.facture, montant: resultat.paiement.montant, avertissementComptable };
}

// Rend au client tout ou partie de son crédit (comptant, chèque…)
async function rembourserCredit(clientId, { montant, modePaiement, compteTresorerieId, reference }, { creePar = null, date = new Date() } = {}) {
  const m = arrondir(Number(montant));
  if (!Number.isFinite(m) || m <= 0) throw new Error("Entre le montant remboursé.");
  if (modePaiement && !MODES_VALIDES.includes(modePaiement)) throw new Error("Mode de paiement invalide.");
  if (!compteTresorerieId) throw new Error("Choisis le compte d'où sort l'argent.");
  const compte = await prisma.compteTresorerie.findUnique({ where: { id: compteTresorerieId }, include: { compte: true } });
  if (!compte) throw new Error("Compte introuvable.");

  const credit = await prisma.$transaction(async (tx) => {
    const disponible = await soldeCredit(clientId, tx);
    if (m > disponible + 0.005) throw new Error(`Le client n'a que ${disponible.toFixed(2)} $ de crédit.`);
    return tx.creditClient.create({
      data: {
        clientId, type: "REMBOURSE", montant: -m, modePaiement: modePaiement || null, compteTresorerieId,
        reference: String(reference || "").trim() || null, date, creePar,
      },
    });
  });
  const client = await nomClient(clientId);
  const description = `Crédit client remboursé${client ? ` — ${client}` : ""}${suffixePaiement(credit)}`;
  const avertissementComptable = await comptabiliserMouvement(credit, { description, debit: COMPTE_CREDITS, creditCompte: compte.compte.numero, creePar });
  return { credit, avertissementComptable };
}

// Dépôt plus grand que sa facture : l'excédent (« à rembourser ») passe au
// crédit du client au lieu de lui être rendu
async function transfererExcedentDepot(depotId, { creePar = null } = {}) {
  const { resteDepot, COMPTE_DEPOTS } = require("./depots");
  const credit = await prisma.$transaction(async (tx) => {
    const d = await tx.depotClient.findUnique({
      where: { id: depotId },
      include: { paiementFacture: { select: { montant: true } }, creditClient: true, bon: { select: { clientId: true, numero: true, facture: { select: { id: true, statut: true } } } } },
    });
    if (!d) throw new Error("Dépôt introuvable.");
    if (d.creditClient) throw new Error("L'excédent de ce dépôt est déjà au crédit du client.");
    if (!d.bon?.facture || d.bon.facture.statut === "ANNULEE") throw new Error("Le bon de ce dépôt n'est pas encore facturé.");
    const reste = resteDepot(d);
    if (reste <= 0.005) throw new Error("Ce dépôt n'a pas d'excédent.");
    return tx.creditClient.create({
      data: { clientId: d.bon.clientId, type: "DEPOT", montant: reste, factureId: d.bon.facture.id, depotClientId: d.id, date: new Date(), creePar },
      include: { depotClient: { select: { bon: { select: { numero: true } } } } },
    });
  });
  const client = await nomClient(credit.clientId);
  const description = `Excédent du dépôt du bon #${credit.depotClient.bon.numero} passé au crédit client${client ? ` — ${client}` : ""}`;
  const avertissementComptable = await comptabiliserMouvement(credit, { description, debit: COMPTE_DEPOTS, creditCompte: COMPTE_CREDITS, creePar });
  return { credit, avertissementComptable };
}

// Retire un mouvement entré par erreur, avec son écriture. Un crédit
// appliqué se retire sur sa facture (✕ sur le paiement). Un crédit reçu ne
// se retire pas s'il a déjà servi (le solde deviendrait négatif).
async function retirerMouvementCredit(creditId) {
  const c = await prisma.creditClient.findUnique({ where: { id: creditId } });
  if (!c) throw new Error("Mouvement introuvable.");
  if (c.type === "APPLIQUE") throw new Error("Ce crédit est appliqué sur une facture — retire-le de la facture (✕ sur le paiement).");
  if (c.montant > 0) {
    const solde = await soldeCredit(c.clientId);
    if (solde - c.montant < -0.005) {
      throw new Error(`Ce crédit a déjà servi : il ne reste que ${solde.toFixed(2)} $ au client. Retire d'abord le crédit appliqué sur la facture.`);
    }
  }
  if (c.ecritureId) {
    const lignes = await prisma.ligneEcriture.findMany({ where: { ecritureId: c.ecritureId } });
    if (lignes.some((l) => l.rapprochementId)) {
      throw new Error("Ce mouvement fait partie d'une conciliation bancaire enregistrée — annule d'abord la conciliation.");
    }
    if (lignes.some((l) => l.transactionBancaireId)) {
      throw new Error("Ce mouvement est associé à une transaction bancaire — annule d'abord son examen (Comptabilité → Transactions bancaires).");
    }
    await verifierPeriodeModifiable(c.date, { nouvellePiece: false });
  }
  await prisma.$transaction(async (tx) => {
    if (c.ecritureId) await tx.ecritureComptable.deleteMany({ where: { id: c.ecritureId } });
    await tx.creditClient.delete({ where: { id: c.id } });
  });
}

module.exports = {
  COMPTE_CREDITS, MODE_CREDIT_CLIENT, LABEL_TYPE_CREDIT,
  soldeCredit, soldesCredits, comptabiliserTropPayes, appliquerCredit, rembourserCredit, transfererExcedentDepot, retirerMouvementCredit,
};
