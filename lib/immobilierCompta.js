// Immobilier relié à la comptabilité — option du forfait, activée seulement
// par le développeur ou le super-administrateur (Administrateur → Modules,
// sous Immobilier : Parametre « module_immobilier_comptabilite »), inactive
// par défaut : sans elle, le module reste autonome, comme avant. Le client
// règle ensuite la date de départ et le compte de banque (Immobilier →
// Comptabilité). Active (et le module Comptabilité aussi), à partir de la
// date de départ choisie :
//
//   1. Loyers et frais inscrits aux baux (ChargeImmo) : débit « Loyers à
//      recevoir », crédit « Revenus de location » (ou « Autres revenus de
//      location » pour les frais) — un crédit au bail fait l'inverse.
//   2. Paiements des locataires (PaiementImmo) : débit du compte de
//      trésorerie choisi (conciliation bancaire), crédit « Loyers à recevoir ».
//   3. Dépenses des immeubles (DepenseImmo) : facture du fournisseur aux
//      comptes à payer (Depense, origine IMMO_DEPENSE), payée là comme les
//      autres — ou tout de suite, « déjà payée » à la saisie.
//   4. Réparations terminées avec un coût réel (ReparationImmo) : facture de
//      l'entrepreneur aux comptes à payer (origine IMMO_REPARATION).
//   Travaux majeurs (catégorie « Travaux majeurs » ou réparation cochée
//   « dépense d'immobilisation ») : au compte d'actif « Immeubles —
//   améliorations », pas en dépense.
//
// Taxes : le loyer résidentiel est exonéré, la TPS et la TVQ payées sur les
// dépenses d'un immeuble ne sont donc pas récupérables — elles restent dans
// le montant de la dépense (aucun CTI ni RTI).
//
// L'Immobilier reste la source : synchroniserComptaImmo() compare ce qu'il
// contient à ce qui est aux livres et corrige l'écart (écriture ou facture
// créée, refaite si le montant, la date ou le fournisseur ont changé,
// retirée si l'élément a disparu). Elle est appelée après chaque
// modification de l'Immobilier, à la vérification quotidienne et depuis
// Immobilier → Comptabilité. Rien n'est touché dans une période verrouillée
// ou fermée, ni une écriture déjà conciliée : l'écart est signalé. Une
// facture déjà payée dont l'élément disparaît reste aux comptes à payer
// (détachée). Désactiver le lien arrête la synchronisation ; ce qui est aux
// livres y reste.
//
// Comptes et postes créés à la première activation seulement (jamais dans
// une installation qui ne s'en sert pas). Réglages du client : Parametre
// « immo_comptabilite » (JSON). Aucun réglage de profil. Moteur commun avec
// la Copropriété : lib/lienCompta.js.

import { prisma } from "./prisma";
import { creerLienCompta, arrondi, court } from "./lienCompta";
import { CATEGORIES_DEPENSE, TYPES_CHARGE, libelle, nomLogement } from "./immobilierCalculs";

export { statutsFactures } from "./lienCompta";

export const ORIGINE_DEPENSE = "IMMO_DEPENSE";
export const ORIGINE_REPARATION = "IMMO_REPARATION";
const SOURCE_CHARGE = "IMMO_CHARGE";
const SOURCE_PAIEMENT = "IMMO_PAIEMENT";

// Comptes du plan comptable propres à la location (numéro souhaité : un
// autre est pris s'il est occupé par un compte différent)
const COMPTES = {
  aRecevoir: { numero: "1150", nom: "Loyers à recevoir", type: "ACTIF" },
  ameliorations: { numero: "1450", nom: "Immeubles — améliorations (immobilisations)", type: "ACTIF" },
  revenus: { numero: "4600", nom: "Revenus de location", type: "REVENU" },
  autresRevenus: { numero: "4610", nom: "Autres revenus de location", type: "REVENU" },
};

// Postes des comptes à payer : un par catégorie de dépense de l'Immobilier,
// plus les réparations. compte : clé de COMPTES (actif) au lieu d'un compte
// de dépense.
const POSTES = [
  { code: "TAXES_MUNICIPALES", numero: "5600", nom: "Immeubles — taxes municipales" },
  { code: "TAXES_SCOLAIRES", numero: "5610", nom: "Immeubles — taxe scolaire" },
  { code: "ASSURANCE", numero: "5620", nom: "Immeubles — assurances" },
  { code: "INTERETS", numero: "5630", nom: "Immeubles — intérêts hypothécaires" },
  { code: "ELECTRICITE", numero: "5640", nom: "Immeubles — électricité" },
  { code: "CHAUFFAGE", numero: "5650", nom: "Immeubles — chauffage" },
  { code: "ENTRETIEN", numero: "5660", nom: "Immeubles — entretien courant" },
  { code: "DENEIGEMENT", numero: "5670", nom: "Immeubles — déneigement, paysagement" },
  { code: "GESTION", numero: "5680", nom: "Immeubles — gestion, publicité, frais bancaires" },
  { code: "HONORAIRES", numero: "5690", nom: "Immeubles — honoraires professionnels" },
  { code: "AUTRE", numero: "5700", nom: "Immeubles — autres dépenses" },
  { code: "REPARATIONS", numero: "5710", nom: "Immeubles — réparations" },
  { code: "IMMOBILISATION", compte: "ameliorations", nom: "Immeubles — travaux majeurs (immobilisation)" },
];

const LIEU = { select: { numero: true, type: true, immeuble: { select: { nom: true } } } };
const lieuDe = (logement) => (logement ? `${logement.immeuble.nom}, ${nomLogement(logement)}` : "");

// Ce qui doit être aux livres, à partir de la date de départ
async function preparer({ depuis, comptes, postes, encaissement, payer, fournisseurNomme }) {
  // 1. Loyers et frais
  const charges = await prisma.chargeImmo.findMany({ where: { date: { gte: depuis } }, include: { bail: { select: { logement: LIEU } } }, orderBy: { date: "asc" } });
  const voulusCharges = charges.filter((c) => arrondi(c.montant) !== 0).map((c) => {
    const m = arrondi(c.montant);
    const revenu = c.type === "LOYER" ? comptes.revenus : comptes.autresRevenus;
    const description = court(`${c.description || libelle(TYPES_CHARGE, c.type)} — ${lieuDe(c.bail.logement)}`);
    const lignes = m > 0
      ? [{ compteNumero: comptes.aRecevoir, debit: m, description }, { compteNumero: revenu, credit: m, description }]
      : [{ compteNumero: revenu, debit: -m, description }, { compteNumero: comptes.aRecevoir, credit: -m, description }];
    return { id: c.id, date: c.date, description, lignes };
  });

  // 2. Paiements des locataires
  const paiements = await prisma.paiementImmo.findMany({ where: { date: { gte: depuis } }, include: { bail: { select: { logement: LIEU } } }, orderBy: { date: "asc" } });
  const voulusPaiements = paiements.filter((p) => arrondi(p.montant) > 0).map((p) => {
    const m = arrondi(p.montant);
    const description = court(`Paiement de loyer${p.reference ? ` (réf. ${p.reference})` : ""} — ${lieuDe(p.bail.logement)}`);
    return { id: p.id, date: p.date, description, lignes: [{ compteNumero: encaissement.compteNumero, debit: m, description }, { compteNumero: comptes.aRecevoir, credit: m, description }] };
  });

  // 3. Dépenses des immeubles → comptes à payer
  const depenses = await prisma.depenseImmo.findMany({ where: { date: { gte: depuis } }, include: { immeuble: { select: { nom: true } } } });
  const voulusDepenses = [];
  for (const d of depenses.filter((x) => arrondi(x.montant) > 0)) {
    let fournisseurId = d.fournisseurId;
    if (!fournisseurId) {
      fournisseurId = await fournisseurNomme(d.payeA);
      await prisma.depenseImmo.update({ where: { id: d.id }, data: { fournisseurId } });
    }
    const quoi = d.description || libelle(CATEGORIES_DEPENSE, d.categorie);
    voulusDepenses.push({
      id: d.id, date: d.date, montant: arrondi(d.montant), fournisseurId,
      description: court(`${d.immeuble.nom} — ${quoi}${d.reference ? ` (réf. ${d.reference})` : ""}`),
      posteId: postes[d.categorie] || postes.AUTRE,
      payer: payer[d.id] ? { ...encaissement, mode: payer[d.id].mode } : null,
    });
  }

  // 4. Réparations terminées avec un coût réel → comptes à payer
  const reparations = await prisma.reparationImmo.findMany({
    where: { statut: "TERMINEE", coutReel: { gt: 0 }, OR: [{ dateFin: { gte: depuis } }, { dateFin: null, creeLe: { gte: depuis } }] },
    include: { immeuble: { select: { nom: true } } },
  });
  const voulusReparations = [];
  for (const rep of reparations) {
    let fournisseurId = rep.fournisseurId;
    if (!fournisseurId) {
      fournisseurId = await fournisseurNomme(rep.entrepreneur);
      await prisma.reparationImmo.update({ where: { id: rep.id }, data: { fournisseurId } });
    }
    voulusReparations.push({
      id: rep.id, date: rep.dateFin || rep.creeLe, montant: arrondi(rep.coutReel), fournisseurId,
      description: court(`${rep.immeuble.nom} — ${rep.numero} ${rep.titre}${rep.numeroFacture ? ` (facture ${rep.numeroFacture})` : ""}`),
      posteId: rep.immobilisation ? postes.IMMOBILISATION : postes.REPARATIONS,
      payer: null,
    });
  }

  return { [SOURCE_CHARGE]: voulusCharges, [SOURCE_PAIEMENT]: voulusPaiements, [ORIGINE_DEPENSE]: voulusDepenses, [ORIGINE_REPARATION]: voulusReparations };
}

const lien = creerLienCompta({
  nom: "Immobilier",
  retireDe: "retirée de l'Immobilier",
  cleModule: "module_immobilier",
  cleOption: "module_immobilier_comptabilite",
  cle: "immo_comptabilite",
  cleDernier: "immo_comptabilite_dernier",
  comptes: COMPTES,
  postes: POSTES,
  prefixePoste: "IMMO_",
  fournisseurDivers: "Divers — immeubles",
  groupes: [
    { genre: "ecritures", source: SOURCE_CHARGE, libelle: "loyers", libelleEtat: "Écritures de loyers et de frais" },
    { genre: "ecritures", source: SOURCE_PAIEMENT, libelle: "paiements", libelleEtat: "Écritures de paiements" },
    { genre: "factures", origine: ORIGINE_DEPENSE, libelle: "dépenses" },
    { genre: "factures", origine: ORIGINE_REPARATION, libelle: "réparations" },
  ],
  preparer,
});

export const CLE_OPTION = lien.CLE_OPTION;
export const lireLienCompta = lien.lire;
export const lienComptaActif = lien.actif;
export const enregistrerLienCompta = lien.enregistrer;
export const dernierResultatCompta = lien.dernier;
export const assurerComptesImmo = lien.assurerComptes;
export const periodeImmoBloquee = lien.periodeBloquee;
export const synchroniserComptaImmo = lien.synchroniser;
export const etatLienCompta = lien.etat;
