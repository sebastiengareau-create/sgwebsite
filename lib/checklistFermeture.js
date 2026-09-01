// Assemble la checklist de fermeture pour un mois donné — seuls les items
// bloquants comptent dans le pourcentage ; les items informatifs sont
// affichés à titre indicatif seulement (voir plan de fermeture de période).
const { prisma } = require("./prisma");
const { limitesMoisQuebec } = require("./temps");
const { calculerTpsTvq } = require("./rapportsComptables");

async function obtenirChecklist(annee, mois) {
  const { debut, fin } = limitesMoisQuebec(annee, mois);

  const [ecritures, paiesBrouillon, immobilisationsActives, amortissementMois, facturesImpayees, tpsTvq, dernierRapprochement, clientsARecevoir, fournisseursAPayer] = await Promise.all([
    prisma.ecritureComptable.findMany({ where: { date: { gte: debut, lte: fin } }, include: { lignes: true } }),
    prisma.paie.count({ where: { statut: "BROUILLON", periodeFin: { gte: debut, lte: fin } } }),
    prisma.immobilisation.count({ where: { actif: true } }),
    prisma.amortissementMensuel.findUnique({ where: { mois: `${annee}-${String(mois).padStart(2, "0")}` } }),
    prisma.facture.count({ where: { statut: "IMPAYEE", dateEmission: { gte: debut, lte: fin } } }),
    calculerTpsTvq({ debut, fin }),
    prisma.rapprochementBancaire.findFirst({ orderBy: { dateRapprochement: "desc" } }),
    prisma.facture.aggregate({ where: { statut: "IMPAYEE" }, _sum: { totalAvecTaxes: true }, _count: true }),
    prisma.depense.aggregate({ where: { statut: "IMPAYEE" }, _sum: { montant: true }, _count: true }),
  ]);

  const ecrituresDesequilibrees = ecritures.filter((e) => {
    const debit = e.lignes.reduce((s, l) => s + l.debit, 0);
    const credit = e.lignes.reduce((s, l) => s + l.credit, 0);
    return Math.abs(debit - credit) > 0.02;
  });

  const blocages = [];
  blocages.push({
    cle: "ecritures_equilibrees",
    label: "Toutes les écritures sont équilibrées",
    ok: ecrituresDesequilibrees.length === 0,
    detail: ecrituresDesequilibrees.length > 0 ? `${ecrituresDesequilibrees.length} écriture(s) déséquilibrée(s)` : null,
  });
  blocages.push({
    cle: "paie_completee",
    label: "Paie complétée (aucun brouillon)",
    ok: paiesBrouillon === 0,
    detail: paiesBrouillon > 0 ? `${paiesBrouillon} paie(s) en brouillon` : null,
  });
  if (immobilisationsActives > 0) {
    blocages.push({
      cle: "amortissements",
      label: "Amortissements du mois enregistrés",
      ok: !!amortissementMois,
      detail: !amortissementMois ? "Amortissement du mois pas encore comptabilisé" : null,
    });
  }

  const informatifs = [
    { cle: "factures_impayees", label: "Factures impayées émises ce mois", valeur: facturesImpayees },
    { cle: "clients_a_recevoir", label: "Comptes clients (total)", valeur: `${(clientsARecevoir._sum.totalAvecTaxes || 0).toFixed(2)} $ (${clientsARecevoir._count})` },
    { cle: "fournisseurs_a_payer", label: "Comptes fournisseurs (total)", valeur: `${(fournisseursAPayer._sum.montant || 0).toFixed(2)} $ (${fournisseursAPayer._count})` },
    { cle: "conciliation_bancaire", label: "Dernière conciliation bancaire", valeur: dernierRapprochement ? new Date(dernierRapprochement.dateRapprochement).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" }) : "Aucune" },
    { cle: "tps_tvq", label: "TPS/TVQ à remettre", valeur: `${(tpsTvq.tps.nette + tpsTvq.tvq.nette).toFixed(2)} $` },
  ];

  const bloquantsApplicables = blocages.length;
  const bloquantsReussis = blocages.filter((b) => b.ok).length;
  const pourcentage = bloquantsApplicables === 0 ? 100 : Math.round((bloquantsReussis / bloquantsApplicables) * 100);

  return { blocages, informatifs, pourcentage, peutFermer: blocages.every((b) => b.ok) };
}

module.exports = { obtenirChecklist };
