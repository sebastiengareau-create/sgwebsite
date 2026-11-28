// Copropriété reliée à la comptabilité — option du forfait, activée seulement
// par le développeur ou le super-administrateur (Administrateur → Modules,
// sous Copropriété : Parametre « module_copropriete_comptabilite »),
// inactive par défaut : sans elle, la Copropriété reste autonome, comme
// avant. Le client règle ensuite la date de départ et le compte de banque
// (Copropriété → Comptabilité). Active (et le module Comptabilité aussi), à
// partir de la date de départ, pour les livres du syndicat :
//
//   1. Cotisations aux charges communes (ChargeCopro « COTISATION ») : débit
//      « Cotisations à recevoir », crédit réparti entre le fonds
//      d'exploitation, le fonds de prévoyance et le fonds d'autoassurance
//      dans la proportion du budget de l'exercice de son bâtiment (BudgetCopro). Cotisations
//      spéciales, frais d'usage des stationnements et rangements, et autres
//      charges à leur propre compte de revenus. Un crédit fait l'inverse.
//   2. Paiements des copropriétaires (PaiementCopro) : débit du compte de
//      trésorerie choisi (conciliation bancaire), crédit « Cotisations à
//      recevoir ».
//   3. Bons de travail terminés avec un coût réel (TravailCopro) : facture du
//      fournisseur aux comptes à payer (Depense, origine COPRO_TRAVAIL), au
//      poste des réparations, ou à celui des travaux du fonds de prévoyance
//      si le bon est coché « payé par le fonds de prévoyance ».
//   Les autres dépenses du syndicat (assurances, électricité, déneigement,
//   entretien ménager, gestion…) s'entrent aux comptes à payer, à leurs
//   postes « Copropriété — … », créés avec le lien.
//
// Taxes : un syndicat de copropriété résidentiel ne récupère pas la TPS ni la
// TVQ ; elles restent dans le montant de la facture.
//
// Moteur commun avec l'Immobilier : lib/lienCompta.js (synchronisation,
// périodes verrouillées, écritures conciliées, factures payées détachées).
// Réglages du client : Parametre « copro_comptabilite » (JSON). Aucun
// réglage de profil.

import { prisma } from "./prisma";
import { creerLienCompta, arrondi, court } from "./lienCompta";
import { TYPES_CHARGE, libelle, budgetDuGroupe, seulGroupe } from "./coproprieteCalculs";

export { statutsFactures } from "./lienCompta";

export const ORIGINE_TRAVAIL = "COPRO_TRAVAIL";
const SOURCE_CHARGE = "COPRO_CHARGE";
const SOURCE_PAIEMENT = "COPRO_PAIEMENT";

const COMPTES = {
  aRecevoir: { numero: "1160", nom: "Cotisations à recevoir", type: "ACTIF" },
  exploitation: { numero: "4700", nom: "Cotisations — fonds d'exploitation", type: "REVENU" },
  prevoyance: { numero: "4710", nom: "Cotisations — fonds de prévoyance", type: "REVENU" },
  autoAssurance: { numero: "4720", nom: "Cotisations — fonds d'autoassurance", type: "REVENU" },
  speciales: { numero: "4730", nom: "Cotisations spéciales", type: "REVENU" },
  usage: { numero: "4740", nom: "Frais d'usage (stationnements, rangements)", type: "REVENU" },
  autres: { numero: "4750", nom: "Autres revenus du syndicat", type: "REVENU" },
};

// Postes des comptes à payer du syndicat
const POSTES = [
  { code: "REPARATIONS", numero: "5800", nom: "Copropriété — entretien et réparations" },
  { code: "PREVOYANCE", numero: "5810", nom: "Copropriété — travaux du fonds de prévoyance" },
  { code: "ASSURANCES", numero: "5820", nom: "Copropriété — assurances" },
  { code: "ENERGIE", numero: "5830", nom: "Copropriété — électricité et chauffage des parties communes" },
  { code: "MENAGE", numero: "5840", nom: "Copropriété — entretien ménager" },
  { code: "DENEIGEMENT", numero: "5850", nom: "Copropriété — déneigement et paysagement" },
  { code: "GESTION", numero: "5860", nom: "Copropriété — gestion et administration" },
  { code: "HONORAIRES", numero: "5870", nom: "Copropriété — honoraires professionnels" },
  { code: "AUTRES", numero: "5880", nom: "Copropriété — autres dépenses" },
];

const COMPTE_SELON_TYPE = { SPECIALE: "speciales", ESPACE: "usage", AUTRE: "autres" };

// Parts d'une cotisation (montant m, positif ou négatif) selon le budget :
// { exploitation, prevoyance, autoAssurance } — le reste à l'exploitation,
// pour que la somme fasse toujours m
export function partsCotisation(m, budget) {
  const total = (budget?.chargesCourantes || 0) + (budget?.fondsPrevoyance || 0) + (budget?.fondsAutoAssurance || 0);
  if (!(total > 0)) return { exploitation: arrondi(m), prevoyance: 0, autoAssurance: 0 };
  const prevoyance = arrondi((m * (budget.fondsPrevoyance || 0)) / total);
  const autoAssurance = arrondi((m * (budget.fondsAutoAssurance || 0)) / total);
  return { exploitation: arrondi(m - prevoyance - autoAssurance), prevoyance, autoAssurance };
}

const UNITE = { select: { numero: true, batimentId: true, batiment: { select: { nom: true } } } };
const lieuDe = (u) => (u ? `unité ${u.numero}${u.batiment ? `, ${u.batiment.nom}` : ""}` : "");
const moisDe = (date) => new Date(date).toISOString().slice(0, 7);

async function preparer({ depuis, comptes, postes, encaissement, payer, fournisseurNomme }) {
  // 1. Cotisations et autres charges
  const [charges, budgets, groupes] = await Promise.all([
    prisma.chargeCopro.findMany({ where: { date: { gte: depuis } }, include: { unite: UNITE }, orderBy: { date: "asc" } }),
    prisma.budgetCopro.findMany(),
    prisma.uniteCopro.findMany({ select: { batimentId: true }, distinct: ["batimentId"] }),
  ]);
  // Budget du bâtiment de l'unité (100 % des quotes-parts par bâtiment)
  const seul = seulGroupe(groupes);
  const voulusCharges = charges.filter((c) => arrondi(c.montant) !== 0).map((c) => {
    const m = arrondi(c.montant);
    const description = court(`${c.description || libelle(TYPES_CHARGE, c.type)} — ${lieuDe(c.unite)}`);
    const credits = c.type === "COTISATION"
      ? Object.entries(partsCotisation(m, budgetDuGroupe(budgets, c.periode || moisDe(c.date), c.unite?.batimentId, seul))).filter(([, v]) => v !== 0).map(([fonds, v]) => [comptes[fonds], v])
      : [[comptes[COMPTE_SELON_TYPE[c.type] || "autres"], m]];
    // Montant positif : débit à recevoir, crédit aux revenus ; négatif : l'inverse
    const lignes = [
      m > 0 ? { compteNumero: comptes.aRecevoir, debit: m, description } : { compteNumero: comptes.aRecevoir, credit: -m, description },
      ...credits.map(([compte, v]) => (v > 0 ? { compteNumero: compte, credit: v, description } : { compteNumero: compte, debit: -v, description })),
    ];
    return { id: c.id, date: c.date, description, lignes };
  });

  // 2. Paiements des copropriétaires
  const paiements = await prisma.paiementCopro.findMany({ where: { date: { gte: depuis } }, include: { unite: UNITE }, orderBy: { date: "asc" } });
  const voulusPaiements = paiements.filter((p) => arrondi(p.montant) > 0).map((p) => {
    const m = arrondi(p.montant);
    const description = court(`Paiement des charges communes${p.reference ? ` (réf. ${p.reference})` : ""} — ${lieuDe(p.unite)}`);
    return { id: p.id, date: p.date, description, lignes: [{ compteNumero: encaissement.compteNumero, debit: m, description }, { compteNumero: comptes.aRecevoir, credit: m, description }] };
  });

  // 3. Bons de travail terminés avec un coût réel → comptes à payer
  const travaux = await prisma.travailCopro.findMany({
    where: { statut: "TERMINE", coutReel: { gt: 0 }, OR: [{ dateFin: { gte: depuis } }, { dateFin: null, creeLe: { gte: depuis } }] },
    include: { batiment: { select: { nom: true } }, unite: { select: { numero: true } } },
  });
  const voulusTravaux = [];
  for (const t of travaux) {
    let fournisseurId = t.fournisseurId;
    if (!fournisseurId) {
      fournisseurId = await fournisseurNomme(null);
      await prisma.travailCopro.update({ where: { id: t.id }, data: { fournisseurId } });
    }
    const ou = t.unite ? `unité ${t.unite.numero}` : t.batiment?.nom || t.emplacement || "parties communes";
    voulusTravaux.push({
      id: t.id, date: t.dateFin || t.creeLe, montant: arrondi(t.coutReel), fournisseurId,
      description: court(`${t.numero} ${t.titre} — ${ou}${t.numeroFacture ? ` (facture ${t.numeroFacture})` : ""}`),
      posteId: t.fondsPrevoyance ? postes.PREVOYANCE : postes.REPARATIONS,
      payer: payer[t.id] ? { ...encaissement, mode: payer[t.id].mode } : null,
    });
  }

  return { [SOURCE_CHARGE]: voulusCharges, [SOURCE_PAIEMENT]: voulusPaiements, [ORIGINE_TRAVAIL]: voulusTravaux };
}

const lien = creerLienCompta({
  nom: "Copropriété",
  retireDe: "retirée de la Copropriété",
  cleModule: "module_copropriete",
  cleOption: "module_copropriete_comptabilite",
  cle: "copro_comptabilite",
  cleDernier: "copro_comptabilite_dernier",
  comptes: COMPTES,
  postes: POSTES,
  prefixePoste: "COPRO_",
  fournisseurDivers: "Divers — copropriété",
  groupes: [
    { genre: "ecritures", source: SOURCE_CHARGE, libelle: "cotisations", libelleEtat: "Écritures de cotisations et de frais" },
    { genre: "ecritures", source: SOURCE_PAIEMENT, libelle: "paiements", libelleEtat: "Écritures de paiements" },
    { genre: "factures", origine: ORIGINE_TRAVAIL, libelle: "travaux" },
  ],
  preparer,
});

export const lireLienComptaCopro = lien.lire;
export const lienComptaCoproActif = lien.actif;
export const enregistrerLienComptaCopro = lien.enregistrer;
export const dernierResultatComptaCopro = lien.dernier;
export const periodeCoproBloquee = lien.periodeBloquee;
export const synchroniserComptaCopro = lien.synchroniser;
export const etatLienComptaCopro = lien.etat;
