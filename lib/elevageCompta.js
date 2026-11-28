// Élevage relié à la comptabilité — option du forfait, activée seulement par
// le développeur ou le super-administrateur (Administrateur → Modules, sous
// Élevage : Parametre « module_elevage_comptabilite »), inactive par défaut :
// sans elle, l'Élevage reste autonome, comme avant. Le client règle ensuite
// la date de départ et le compte de banque (Élevage → Comptabilité). Active
// (et le module Comptabilité aussi), à partir de la date de départ :
//
//   1. Achats de bêtes (Bete « ACHETEE » avec un coût d'acquisition) :
//      facture du vendeur (provenance) aux comptes à payer (Depense, origine
//      ELEVAGE_ACHAT), au poste « Élevage — achats d'animaux ».
//   2. Frais des bêtes (FraisBete : alimentation, vétérinaire, transport…) :
//      facture du fournisseur aux comptes à payer (origine ELEVAGE_FRAIS), au
//      poste de sa catégorie — ou payée tout de suite, « déjà payée » à la
//      saisie.
//   3. Frais d'abattage et de découpe (Abattage) : facture de l'abattoir aux
//      comptes à payer (origine ELEVAGE_ABATTAGE).
//   4. Ventes de viande (VenteViande, boutique ou en ligne) : débit du compte
//      de trésorerie choisi (conciliation bancaire), crédit « Ventes de
//      viande ».
//   5. Ventes sur pied (Bete « VENDUE » avec un prix) : débit du compte de
//      trésorerie, crédit « Ventes d'animaux ».
//   Un fournisseur sans fiche est créé à son nom (même nom, sans tenir
//   compte des majuscules : la fiche existante sert) ; sans nom, « Divers —
//   élevage ».
//
// Taxes : les montants de l'Élevage sont avant taxes et vont aux livres
// ainsi — la viande, les animaux et les aliments du bétail sont détaxés.
//
// Moteur commun avec l'Immobilier et la Copropriété : lib/lienCompta.js
// (synchronisation, périodes verrouillées, écritures conciliées, factures
// payées détachées). Réglages du client : Parametre « elevage_comptabilite »
// (JSON). Aucun réglage de profil.

import { prisma } from "./prisma";
import { creerLienCompta, arrondi, court } from "./lienCompta";
import { CATEGORIES_FRAIS, CANAUX } from "./elevageCalculs";

export { statutsFactures } from "./lienCompta";

export const ORIGINE_ACHAT = "ELEVAGE_ACHAT";
export const ORIGINE_FRAIS = "ELEVAGE_FRAIS";
export const ORIGINE_ABATTAGE = "ELEVAGE_ABATTAGE";
const SOURCE_VENTE = "ELEVAGE_VENTE";
const SOURCE_VENTE_PIED = "ELEVAGE_VENTE_PIED";

const COMPTES = {
  viande: { numero: "4800", nom: "Ventes de viande", type: "REVENU" },
  animaux: { numero: "4810", nom: "Ventes d'animaux (sur pied)", type: "REVENU" },
};

// Postes des comptes à payer : achats, une catégorie de frais chacune, abattage
const POSTES = [
  { code: "ACHAT", numero: "5900", nom: "Élevage — achats d'animaux" },
  { code: "ALIMENTATION", numero: "5910", nom: "Élevage — alimentation" },
  { code: "VETERINAIRE", numero: "5920", nom: "Élevage — vétérinaire et soins" },
  { code: "TRANSPORT", numero: "5930", nom: "Élevage — transport" },
  { code: "AUTRE", numero: "5940", nom: "Élevage — autres frais" },
  { code: "ABATTAGE", numero: "5950", nom: "Élevage — abattage, découpe et emballage" },
];

const libelleDe = (liste, code) => liste.find((x) => x.code === code)?.label || code;
const nomBete = (b) => `${b.numero}${b.nom ? ` ${b.nom}` : ""}`;

async function preparer({ depuis, comptes, postes, encaissement, payer, fournisseurNomme }) {
  // 1. Achats de bêtes
  const achats = await prisma.bete.findMany({
    where: { origine: "ACHETEE", coutAcquisition: { gt: 0 }, OR: [{ dateAcquisition: { gte: depuis } }, { dateAcquisition: null, creeLe: { gte: depuis } }] },
    select: { id: true, numero: true, nom: true, provenance: true, coutAcquisition: true, dateAcquisition: true, creeLe: true },
  });
  const voulusAchats = [];
  for (const b of achats) {
    voulusAchats.push({
      id: b.id, date: b.dateAcquisition || b.creeLe, montant: arrondi(b.coutAcquisition), fournisseurId: await fournisseurNomme(b.provenance),
      description: court(`Achat de la bête ${nomBete(b)}${b.provenance ? ` — ${b.provenance}` : ""}`),
      posteId: postes.ACHAT,
      payer: payer[b.id] ? { ...encaissement, mode: payer[b.id].mode } : null,
    });
  }

  // 2. Frais des bêtes
  const frais = await prisma.fraisBete.findMany({ where: { date: { gte: depuis }, montant: { gt: 0 } }, include: { bete: { select: { numero: true, nom: true } } } });
  const voulusFrais = [];
  for (const f of frais) {
    voulusFrais.push({
      id: f.id, date: f.date, montant: arrondi(f.montant), fournisseurId: await fournisseurNomme(f.fournisseur),
      description: court(`${nomBete(f.bete)} — ${f.description || libelleDe(CATEGORIES_FRAIS, f.categorie)}`),
      posteId: postes[f.categorie] || postes.AUTRE,
      payer: payer[f.id] ? { ...encaissement, mode: payer[f.id].mode } : null,
    });
  }

  // 3. Abattage et découpe
  const abattages = await prisma.abattage.findMany({ where: { date: { gte: depuis }, fraisAbattage: { gt: 0 } }, include: { bete: { select: { numero: true, nom: true } } } });
  const voulusAbattages = [];
  for (const a of abattages) {
    voulusAbattages.push({
      id: a.id, date: a.date, montant: arrondi(a.fraisAbattage), fournisseurId: await fournisseurNomme(a.abattoir),
      description: court(`Abattage et découpe — ${nomBete(a.bete)}${a.abattoir ? ` (${a.abattoir})` : ""}`),
      posteId: postes.ABATTAGE,
      payer: payer[a.id] ? { ...encaissement, mode: payer[a.id].mode } : null,
    });
  }

  // 4. Ventes de viande
  const ventes = await prisma.venteViande.findMany({
    where: { date: { gte: depuis }, montant: { gt: 0 } },
    include: { lot: { select: { coupe: { select: { nom: true } }, abattage: { select: { bete: { select: { numero: true, nom: true } } } } } } },
    orderBy: { date: "asc" },
  });
  const voulusVentes = ventes.map((v) => {
    const m = arrondi(v.montant);
    const description = court(`Vente ${libelleDe(CANAUX, v.canal).toLowerCase()} — ${v.nbPaquets} × ${v.lot.coupe.nom} (${nomBete(v.lot.abattage.bete)})${v.note ? ` — ${v.note}` : ""}`);
    return { id: v.id, date: v.date, description, lignes: [{ compteNumero: encaissement.compteNumero, debit: m, description }, { compteNumero: comptes.viande, credit: m, description }] };
  });

  // 5. Ventes sur pied
  const surPied = await prisma.bete.findMany({ where: { statut: "VENDUE", prixVente: { gt: 0 }, dateSortie: { gte: depuis } }, select: { id: true, numero: true, nom: true, prixVente: true, dateSortie: true } });
  const voulusPied = surPied.map((b) => {
    const m = arrondi(b.prixVente);
    const description = court(`Vente sur pied — ${nomBete(b)}`);
    return { id: b.id, date: b.dateSortie, description, lignes: [{ compteNumero: encaissement.compteNumero, debit: m, description }, { compteNumero: comptes.animaux, credit: m, description }] };
  });

  return { [ORIGINE_ACHAT]: voulusAchats, [ORIGINE_FRAIS]: voulusFrais, [ORIGINE_ABATTAGE]: voulusAbattages, [SOURCE_VENTE]: voulusVentes, [SOURCE_VENTE_PIED]: voulusPied };
}

const lien = creerLienCompta({
  nom: "Élevage",
  retireDe: "retirée de l'Élevage",
  cleModule: "module_elevage",
  cleOption: "module_elevage_comptabilite",
  cle: "elevage_comptabilite",
  cleDernier: "elevage_comptabilite_dernier",
  comptes: COMPTES,
  postes: POSTES,
  prefixePoste: "ELEVAGE_",
  fournisseurDivers: "Divers — élevage",
  groupes: [
    { genre: "ecritures", source: SOURCE_VENTE, libelle: "ventes de viande", libelleEtat: "Écritures de ventes de viande" },
    { genre: "ecritures", source: SOURCE_VENTE_PIED, libelle: "ventes sur pied", libelleEtat: "Écritures de ventes sur pied" },
    { genre: "factures", origine: ORIGINE_ACHAT, libelle: "achats" },
    { genre: "factures", origine: ORIGINE_FRAIS, libelle: "frais" },
    { genre: "factures", origine: ORIGINE_ABATTAGE, libelle: "abattages" },
  ],
  preparer,
});

export const lireLienComptaElevage = lien.lire;
export const lienComptaElevageActif = lien.actif;
export const enregistrerLienComptaElevage = lien.enregistrer;
export const dernierResultatComptaElevage = lien.dernier;
export const periodeElevageBloquee = lien.periodeBloquee;
export const synchroniserComptaElevage = lien.synchroniser;
export const etatLienComptaElevage = lien.etat;

// Pour les routes de l'Élevage : pièce refusée si sa date (ancienne ou
// nouvelle) tombe dans une période verrouillée ou fermée → réponse 423, ou null
export async function refusPeriodeElevage(dates) {
  const message = await periodeElevageBloquee(dates);
  return message ? Response.json({ erreur: message }, { status: 423 }) : null;
}

// Livres remis à jour après une écriture de l'Élevage → { avertissement }
// à joindre à la réponse s'il y a un écart (rien si le lien est inactif)
export async function livresElevage(session, payer = {}) {
  const r = await synchroniserComptaElevage({ creePar: session?.nom || "Élevage", payer });
  return r?.erreurs?.length ? { avertissement: `Comptabilité : ${r.erreurs.join(" · ")}` } : {};
}
