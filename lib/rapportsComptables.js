// Agrégations comptables en lecture seule — aucune écriture n'est jamais
// créée ici. Extrait de la logique déjà dupliquée dans PlanComptableClient,
// etat-resultats et tps-tvq, pour que le résumé de fermeture de période
// n'ait pas besoin de la dupliquer une fois de plus.
const { prisma } = require("./prisma");

const NORMAL_DEBIT = ["ACTIF", "DEPENSE"]; // ces types augmentent au débit

// Solde cumulatif d'un compte par numéro, optionnellement limité aux
// écritures datées au plus tard à `auPlusTard` (sinon, solde à ce jour).
async function calculerSoldeCompte(numero, { auPlusTard } = {}) {
  const compte = await prisma.compte.findUnique({
    where: { numero },
    include: { lignes: auPlusTard ? { where: { ecriture: { date: { lte: auPlusTard } } } } : true },
  });
  if (!compte) return 0;
  const totalDebit = compte.lignes.reduce((s, l) => s + l.debit, 0);
  const totalCredit = compte.lignes.reduce((s, l) => s + l.credit, 0);
  return NORMAL_DEBIT.includes(compte.type) ? totalDebit - totalCredit : totalCredit - totalDebit;
}

// Revenus/dépenses/bénéfice net — sur une plage de dates si fournie
// (flux du mois), sinon depuis le début (comme l'état des résultats).
async function calculerResumeRevenusDepenses({ debut, fin } = {}) {
  const filtreDate = debut && fin ? { ecriture: { date: { gte: debut, lte: fin } } } : undefined;
  const comptes = await prisma.compte.findMany({
    where: { actif: true, type: { in: ["REVENU", "DEPENSE"] } },
    include: { lignes: filtreDate ? { where: filtreDate } : true },
  });
  let revenus = 0;
  let depenses = 0;
  for (const c of comptes) {
    const totalDebit = c.lignes.reduce((s, l) => s + l.debit, 0);
    const totalCredit = c.lignes.reduce((s, l) => s + l.credit, 0);
    if (c.type === "REVENU") revenus += totalCredit - totalDebit;
    else depenses += totalDebit - totalCredit;
  }
  return { revenus, depenses };
}

// Détail des revenus/dépenses PAR POSTE (compte) sur une plage de dates —
// pour l'analyse de rentabilité de la vue d'ensemble, qui a besoin du détail
// (main-d'œuvre, pièces, remorquage… / salaires, charges employeur,
// électricité…), pas juste les deux totaux de calculerResumeRevenusDepenses.
async function calculerDetailRevenusDepenses({ debut, fin } = {}) {
  const filtreDate = debut && fin ? { ecriture: { date: { gte: debut, lte: fin } } } : undefined;
  const comptes = await prisma.compte.findMany({
    where: { actif: true, type: { in: ["REVENU", "DEPENSE"] } },
    include: { lignes: filtreDate ? { where: filtreDate } : true },
    orderBy: { numero: "asc" },
  });

  const postes = comptes.map((c) => {
    const totalDebit = c.lignes.reduce((s, l) => s + l.debit, 0);
    const totalCredit = c.lignes.reduce((s, l) => s + l.credit, 0);
    const montant = c.type === "REVENU" ? totalCredit - totalDebit : totalDebit - totalCredit;
    // Un poste de dépense sans classification est traité comme FIXE — voir
    // la note sur le champ Compte.typeCharge dans le schéma.
    const typeCharge = c.type === "DEPENSE" ? (c.typeCharge === "VARIABLE" ? "VARIABLE" : "FIXE") : undefined;
    return { numero: c.numero, nom: c.nom, type: c.type, montant, typeCharge };
  });

  const revenus = postes.filter((p) => p.type === "REVENU" && p.montant !== 0).sort((a, b) => b.montant - a.montant);
  const depenses = postes.filter((p) => p.type === "DEPENSE" && p.montant !== 0).sort((a, b) => b.montant - a.montant);
  const totalRevenus = revenus.reduce((s, p) => s + p.montant, 0);
  const totalDepenses = depenses.reduce((s, p) => s + p.montant, 0);
  const totalChargesFixes = depenses.filter((p) => p.typeCharge === "FIXE").reduce((s, p) => s + p.montant, 0);
  const totalChargesVariables = depenses.filter((p) => p.typeCharge === "VARIABLE").reduce((s, p) => s + p.montant, 0);

  return { revenus, depenses, totalRevenus, totalDepenses, totalChargesFixes, totalChargesVariables };
}

// TPS/TVQ perçues/payées/nettes sur une plage de dates — même logique que
// le rapport imprimable TPS/TVQ.
async function calculerTpsTvq({ debut, fin }) {
  const [compteTps, compteTvq] = await Promise.all([
    prisma.compte.findUnique({ where: { numero: "2000" }, include: { lignes: { where: { ecriture: { date: { gte: debut, lte: fin } } } } } }),
    prisma.compte.findUnique({ where: { numero: "2010" }, include: { lignes: { where: { ecriture: { date: { gte: debut, lte: fin } } } } } }),
  ]);
  function resumer(compte) {
    if (!compte) return { percue: 0, payee: 0, nette: 0 };
    const percue = compte.lignes.reduce((s, l) => s + l.credit, 0);
    const payee = compte.lignes.reduce((s, l) => s + l.debit, 0);
    return { percue, payee, nette: percue - payee };
  }
  return { tps: resumer(compteTps), tvq: resumer(compteTvq) };
}

// Assemble les 8 chiffres du résumé de fermeture pour un mois donné.
// Clients à recevoir / fournisseurs à payer / solde bancaire sont des
// soldes "à la fin de la période" (sémantique bilan), pas un flux du mois.
async function calculerResumeFermeture({ debut, fin }) {
  const [{ revenus, depenses }, { tps, tvq }, clients, fournisseurs, soldeBancaire] = await Promise.all([
    calculerResumeRevenusDepenses({ debut, fin }),
    calculerTpsTvq({ debut, fin }),
    prisma.facture.aggregate({ where: { statut: "IMPAYEE", dateEmission: { lte: fin } }, _sum: { totalAvecTaxes: true } }),
    prisma.depense.aggregate({ where: { statut: "IMPAYEE", dateFacture: { lte: fin } }, _sum: { montant: true } }),
    calculerSoldeCompte("1000", { auPlusTard: fin }),
  ]);
  return {
    revenus, depenses, beneficeNet: revenus - depenses,
    tpsARemettre: tps.nette, tvqARemettre: tvq.nette,
    clientsARecevoir: clients._sum.totalAvecTaxes || 0,
    fournisseursAPayer: fournisseurs._sum.montant || 0,
    soldeBancaire,
  };
}

module.exports = { calculerSoldeCompte, calculerResumeRevenusDepenses, calculerDetailRevenusDepenses, calculerTpsTvq, calculerResumeFermeture };
