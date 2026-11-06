// Dépôts des clients : argent encaissé avant la facture, sur une soumission
// ou un bon de commande (bouton « 💰 Encaisser un dépôt »), en un ou
// plusieurs paiements comme une facture (montant, mode, compte, référence).
//
// Comptabilité :
// - réception : débit trésorerie (compte choisi) / crédit 2400 « Dépôts de
//   clients » — un passif : l'argent appartient au client tant que le
//   travail n'est pas facturé ;
// - à l'émission de la facture du bon, chaque dépôt y est appliqué comme un
//   paiement (PaiementFacture, débit 2400 / crédit 1100 Comptes clients) :
//   le solde de la facture, des comptes clients et du dossier client en
//   tient compte, comme pour tout autre paiement.
//
// Un dépôt suit le travail : celui d'une soumission passe au bon quand elle
// est acceptée ou facturée (rattacherDepotsAuBon), et y revient si elle est
// remise en attente. Retiré de la facture (✕ sur le paiement), le dépôt
// redevient « non appliqué » et peut être appliqué de nouveau.
const { prisma } = require("./prisma");
const { moduleComptabiliteActif, assurerPlanComptable, creerManquants, enregistrerEcriture, verifierPeriodeModifiable } = require("./comptabilite");
const { recalculerFacture, soldeFacture } = require("./paiementsFactures");
const { MODES_PAIEMENT, LABEL_MODE_PAIEMENT } = require("./modesPaiement");

const COMPTE_DEPOTS = "2400"; // loin de la suite 2140, 2150… des passifs créés à la main
const arrondir = (n) => Math.round(n * 100) / 100;
const MODES_VALIDES = MODES_PAIEMENT.map((m) => m.valeur);

async function assurerCompteDepots() {
  await assurerPlanComptable();
  await creerManquants("compte", "numero", [{ numero: COMPTE_DEPOTS, nom: "Dépôts de clients", type: "PASSIF" }]);
}

// Erreur de période verrouillée → avertissement (le dépôt reste enregistré,
// comme un paiement de facture) ; autre erreur → journal seulement
function avertissementPour(e, contexte) {
  if (e.message?.startsWith("PERIODE_LOCK:")) return e.message.replace("PERIODE_LOCK:", "").split("\n")[0];
  console.error(`Erreur comptabilisation ${contexte} :`, e);
  return null;
}

function libelleCible(depot) {
  if (depot.bon) return `bon #${depot.bon.numero}`;
  if (depot.soumission) return `soumission #${depot.soumission.numero}`;
  return "travail à venir";
}

// Encaisse un ou plusieurs dépôts sur une soumission ou un bon.
// cible : { soumissionId } ou { bonId } ; lignes : [{ montant, modePaiement, compteTresorerieId, reference }]
async function enregistrerDepots(cible, lignes, { creePar = null, date = new Date() } = {}) {
  if (!Array.isArray(lignes) || lignes.length === 0) throw new Error("Ajoute au moins un paiement.");
  const demandes = lignes.map((l) => ({
    montant: arrondir(Number(l.montant)),
    modePaiement: l.modePaiement || null,
    compteTresorerieId: l.compteTresorerieId,
    reference: String(l.reference || "").trim() || null,
  }));
  for (const d of demandes) {
    if (!Number.isFinite(d.montant) || d.montant <= 0) throw new Error("Entre le montant de chaque paiement.");
    if (d.modePaiement && !MODES_VALIDES.includes(d.modePaiement)) throw new Error("Mode de paiement invalide.");
    if (!d.compteTresorerieId) throw new Error("Choisis un compte pour chaque paiement.");
  }

  let soumissionId = null;
  let bonId = null;
  if (cible.soumissionId) {
    const s = await prisma.soumission.findUnique({ where: { id: cible.soumissionId } });
    if (!s) throw new Error("Soumission introuvable.");
    soumissionId = s.id;
    bonId = s.bonId; // déjà transformée : le dépôt va aussi au bon
  } else if (cible.bonId) {
    bonId = cible.bonId;
  } else {
    throw new Error("Soumission ou bon manquant.");
  }
  if (bonId) {
    const bon = await prisma.bonTravail.findUnique({ where: { id: bonId }, include: { facture: true } });
    if (!bon) throw new Error("Bon introuvable.");
    if (bon.vehiculeVenteId) throw new Error("Un bon de véhicule à vendre ne prend pas de dépôt.");
    if (bon.facture && bon.facture.statut !== "ANNULEE") {
      throw new Error(`Le bon #${bon.numero} est déjà facturé (${bon.facture.numero}) — encaisse le paiement sur sa facture.`);
    }
  }

  const idsComptes = [...new Set(demandes.map((d) => d.compteTresorerieId))];
  const comptes = await prisma.compteTresorerie.findMany({ where: { id: { in: idsComptes } }, include: { compte: true } });
  if (comptes.length !== idsComptes.length) throw new Error("Compte introuvable.");
  const compteGl = Object.fromEntries(comptes.map((c) => [c.id, c.compte.numero]));

  const depots = await prisma.$transaction((tx) => Promise.all(demandes.map((d) => tx.depotClient.create({
    data: { ...d, soumissionId, bonId, datePaiement: date, creePar },
    include: { soumission: { select: { numero: true, clientNom: true } }, bon: { select: { numero: true, client: { select: { nom: true } } } } },
  }))));

  let avertissementComptable = null;
  if (await moduleComptabiliteActif()) {
    await assurerCompteDepots();
    for (const d of depots) {
      try {
        const client = d.bon?.client?.nom || d.soumission?.clientNom;
        const mode = d.modePaiement && LABEL_MODE_PAIEMENT[d.modePaiement] ? ` — ${LABEL_MODE_PAIEMENT[d.modePaiement]}` : "";
        const ref = d.reference ? ` (réf. ${d.reference})` : "";
        const description = `Dépôt reçu — ${libelleCible(d)}${client ? ` — ${client}` : ""}${mode}${ref}`;
        const ecriture = await enregistrerEcriture({
          date: d.datePaiement,
          description,
          source: "DEPOT_CLIENT",
          sourceId: d.id,
          lignes: [
            { compteNumero: compteGl[d.compteTresorerieId], debit: d.montant, description },
            { compteNumero: COMPTE_DEPOTS, credit: d.montant, description },
          ],
          creePar,
        });
        await prisma.depotClient.update({ where: { id: d.id }, data: { ecritureId: ecriture.id } });
      } catch (e) {
        avertissementComptable = avertissementPour(e, "dépôt") || avertissementComptable;
      }
    }
  }
  return { depots, avertissementComptable };
}

// Retire un dépôt entré par erreur (ou remboursé) : son écriture est
// supprimée. Refusé s'il est déjà appliqué à une facture, ou si son
// écriture est reliée à la banque (mêmes règles qu'un paiement de facture).
async function retirerDepot(depotId) {
  const d = await prisma.depotClient.findUnique({ where: { id: depotId } });
  if (!d) throw new Error("Dépôt introuvable.");
  if (d.paiementFactureId) throw new Error("Ce dépôt est appliqué à la facture — retire-le d'abord de la facture (✕ sur le paiement).");
  if (await prisma.creditClient.count({ where: { depotClientId: d.id } })) {
    throw new Error("L'excédent de ce dépôt est au crédit du client — retire d'abord ce crédit (fiche du client).");
  }
  if (d.ecritureId) {
    const lignes = await prisma.ligneEcriture.findMany({ where: { ecritureId: d.ecritureId } });
    if (lignes.some((l) => l.rapprochementId)) {
      throw new Error("Ce dépôt fait partie d'une conciliation bancaire enregistrée — annule d'abord la conciliation.");
    }
    if (lignes.some((l) => l.transactionBancaireId)) {
      throw new Error("Ce dépôt est associé à une transaction bancaire — annule d'abord son examen (Comptabilité → Transactions bancaires).");
    }
    await verifierPeriodeModifiable(d.datePaiement, { nouvellePiece: false });
  }
  await prisma.$transaction(async (tx) => {
    if (d.ecritureId) await tx.ecritureComptable.deleteMany({ where: { id: d.ecritureId } });
    await tx.depotClient.delete({ where: { id: d.id } });
  });
}

// Applique à la facture les dépôts du bon pas encore appliqués, du plus
// ancien au plus récent, jusqu'au solde. Un dépôt plus grand que le solde
// n'y met que le solde : le reste demeure au 2400 (à rembourser au client,
// ou à passer à son crédit — lib/creditClient.js). La part déjà passée au
// crédit n'est jamais appliquée de nouveau (facture annulée puis réémise).
// Appelé à l'émission de la facture, et par « Appliquer à la facture ».
async function appliquerDepots(factureId, { creePar = null } = {}) {
  const { MODE_PAIEMENT_COUTANT } = require("./vehiculesAVendre");
  const resultat = await prisma.$transaction(async (tx) => {
    const facture = await tx.facture.findUnique({ where: { id: factureId } });
    if (!facture) throw new Error("Facture introuvable.");
    if (facture.statut !== "IMPAYEE" || facture.modePaiement === MODE_PAIEMENT_COUTANT) return { facture, paiements: [] };
    const depots = await tx.depotClient.findMany({ where: { bonId: facture.bonId, paiementFactureId: null }, include: { creditClient: { select: { montant: true } } }, orderBy: { datePaiement: "asc" } });
    let solde = soldeFacture(facture);
    const paiements = [];
    for (const d of depots) {
      if (solde <= 0.005) break;
      const montant = arrondir(Math.min(d.montant - (d.creditClient?.montant ?? 0), solde));
      if (montant <= 0.005) continue;
      const p = await tx.paiementFacture.create({
        data: {
          factureId, montant, modePaiement: d.modePaiement, compteTresorerieId: d.compteTresorerieId,
          reference: d.reference, datePaiement: new Date(), creePar,
        },
      });
      await tx.depotClient.update({ where: { id: d.id }, data: { paiementFactureId: p.id } });
      paiements.push({ paiement: p, depot: d });
      solde = arrondir(solde - montant);
    }
    if (paiements.length === 0) return { facture, paiements };
    return { facture: await recalculerFacture(tx, factureId), paiements };
  });

  let avertissementComptable = null;
  if (resultat.paiements.length > 0 && (await moduleComptabiliteActif())) {
    await assurerCompteDepots();
    for (const { paiement, depot } of resultat.paiements) {
      try {
        const dateDepot = new Date(depot.datePaiement).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });
        const description = `Facture ${resultat.facture.numero} — dépôt du ${dateDepot} appliqué`;
        const ecriture = await enregistrerEcriture({
          date: paiement.datePaiement,
          description,
          source: "FACTURE_PAYEE", // même source que les paiements : supprimée avec la facture
          sourceId: factureId,
          lignes: [
            { compteNumero: COMPTE_DEPOTS, debit: paiement.montant, description },
            { compteNumero: "1100", credit: paiement.montant, description },
          ],
          creePar,
        });
        await prisma.paiementFacture.update({ where: { id: paiement.id }, data: { ecritureId: ecriture.id } });
      } catch (e) {
        avertissementComptable = avertissementPour(e, "dépôt appliqué") || avertissementComptable;
      }
    }
  }
  return { facture: resultat.facture, nombre: resultat.paiements.length, avertissementComptable };
}

// Soumission acceptée ou facturée : ses dépôts passent au bon créé
async function rattacherDepotsAuBon(tx, soumissionId, bonId) {
  await tx.depotClient.updateMany({ where: { soumissionId, bonId: null }, data: { bonId } });
}

// Montant d'un dépôt encore au 2400 : tout, s'il n'est pas appliqué ; sinon
// l'excédent sur ce qui a été appliqué à la facture (à rembourser), moins ce
// qui en est passé au crédit du client. d.paiementFacture et d.creditClient
// (montant) doivent être inclus.
function resteDepot(d) {
  return arrondir(d.montant - (d.paiementFacture?.montant ?? 0) - (d.creditClient?.montant ?? 0));
}

// Lignes sous le total du bon imprimé et du PDF de la facture : dépôt reçu,
// crédit client, autres paiements et solde. bon.facture.paiements doit
// inclure depot (id) et modePaiement ; bon.depots (montant) sert avant la
// facture. [] : rien à ajouter.
function lignesSoldeBon(bon, totalAvecTaxes) {
  const somme = (liste) => arrondir(liste.reduce((s, x) => s + x.montant, 0));
  const f = bon.facture;
  if (!f) {
    const depots = somme(bon.depots || []);
    if (depots <= 0) return [];
    return [
      { label: "Dépôt reçu", valeur: -depots, petit: true },
      { label: "Solde estimé", valeur: arrondir(totalAvecTaxes - depots), gras: true },
    ];
  }
  if (f.statut === "ANNULEE") return [];
  const depots = somme((f.paiements || []).filter((p) => p.depot));
  const credit = somme((f.paiements || []).filter((p) => p.modePaiement === "CREDIT_CLIENT"));
  const autres = arrondir((f.montantPaye || 0) - depots - credit);
  if (!(depots > 0 || credit > 0 || (f.statut === "IMPAYEE" && f.montantPaye > 0))) return [];
  const lignes = [];
  if (depots > 0) lignes.push({ label: "Dépôt reçu", valeur: -depots, petit: true });
  if (credit > 0) lignes.push({ label: "Crédit client appliqué", valeur: -credit, petit: true });
  if (autres > 0.005) lignes.push({ label: "Montant déjà payé", valeur: -autres, petit: true });
  lignes.push({ label: "Solde dû", valeur: f.statut === "IMPAYEE" ? arrondir(f.totalAvecTaxes - f.montantPaye) : 0, gras: true });
  return lignes;
}

module.exports = { COMPTE_DEPOTS, enregistrerDepots, retirerDepot, appliquerDepots, rattacherDepotsAuBon, resteDepot, lignesSoldeBon };
