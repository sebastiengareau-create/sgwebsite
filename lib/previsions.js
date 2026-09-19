// Prévision de trésorerie — combine plusieurs domaines déjà comptabilisés
// (comptes de trésorerie, comptes clients/fournisseurs, paie, remises
// gouvernementales) en une seule projection. Lecture seule, comme
// lib/rapportsComptables.js — aucune écriture n'est créée ici.
const { prisma } = require("./prisma");
const { obtenirComptesTresorerieAvecSoldes, obtenirResumeTresorerie } = require("./tresorerie");

// Mêmes comptes que app/gerant/comptabilite/remise-gouvernementale — tout ce
// qui est actuellement dû aux gouvernements (TPS/TVQ perçues, retenues à la
// source des employés, charges sociales de l'employeur), peu importe la
// fréquence de remise de chacun.
const COMPTES_REMISE = ["2050", "2040", "2060", "2020", "2030", "2000", "2010"];

async function calculerPrevisionTresorerie() {
  const comptes = await obtenirComptesTresorerieAvecSoldes({ actifSeulement: true });
  const { liquidites } = obtenirResumeTresorerie(comptes);

  const [clients, fournisseurs, comptesRemise, lotBrouillon, derniersLotsVerses] = await Promise.all([
    prisma.facture.aggregate({ where: { statut: "IMPAYEE" }, _sum: { totalAvecTaxes: true } }),
    prisma.depense.aggregate({ where: { statut: "IMPAYEE" }, _sum: { montant: true } }),
    prisma.compte.findMany({ where: { numero: { in: COMPTES_REMISE } }, include: { lignes: true } }),
    // Un lot de paie déjà préparé (pas encore versé) donne le vrai montant à
    // venir — plus fiable qu'une moyenne.
    prisma.lotPaie.findFirst({ where: { statut: "BROUILLON" }, include: { paies: true }, orderBy: { dateVersementPrevue: "asc" } }),
    // À défaut, la moyenne des 3 derniers lots réguliers déjà versés sert
    // d'estimation — clairement identifiée comme telle à l'affichage.
    prisma.lotPaie.findMany({ where: { statut: "COMPTABILISEE", typePaie: "REGULIERE" }, include: { paies: true }, orderBy: { comptabiliseLe: "desc" }, take: 3 }),
  ]);

  const clientsARecevoir = clients._sum.totalAvecTaxes || 0;
  const fournisseursAPayer = fournisseurs._sum.montant || 0;
  const taxesARemettre = comptesRemise.reduce((s, c) => s + c.lignes.reduce((s2, l) => s2 + l.credit - l.debit, 0), 0);

  let paiePrevue = 0;
  let paiePrevueEstimee = false;
  if (lotBrouillon) {
    paiePrevue = lotBrouillon.paies.reduce((s, p) => s + p.salaireNet, 0);
  } else if (derniersLotsVerses.length > 0) {
    paiePrevue = derniersLotsVerses.reduce((s, l) => s + l.paies.reduce((s2, p) => s2 + p.salaireNet, 0), 0) / derniersLotsVerses.length;
    paiePrevueEstimee = true;
  }

  const liquiditesProjetees = liquidites + clientsARecevoir - fournisseursAPayer - paiePrevue - taxesARemettre;

  return {
    soldeActuel: liquidites,
    clientsARecevoir,
    fournisseursAPayer,
    paiePrevue,
    paiePrevueEstimee,
    taxesARemettre,
    liquiditesProjetees,
  };
}

module.exports = { calculerPrevisionTresorerie };
