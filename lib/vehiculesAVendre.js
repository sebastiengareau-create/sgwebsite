// Véhicules à vendre (profil vehiculesAVendre, voir lib/client.js) —
// véhicules qui appartiennent à l'entreprise, gardés en inventaire pour être
// revendus.
//
// - La fiche technique est un dossier Vehicule au nom d'un client interne
//   (« Véhicules à vendre »), pour que les bons faits dessus soient des bons
//   de travail ordinaires (tâches, poinçons, pièces).
// - Un bon relié est facturé sans taxes, et sa facture est payée d'office
//   en ajoutant son montant au coûtant du véhicule : la facture tombe à
//   zéro, le profit de la vente du véhicule baisse d'autant.
// - La vente au client est une facture de vente à part (VTE-001), avec
//   taxes, qui fige le coûtant total pour le profit.
//
// Comptabilité : le véhicule est un actif (1250). Le bon passe aux revenus
// comme une facture normale, puis son « paiement » débite 1250 au lieu
// d'une banque. La vente crédite 4500 et sort le coûtant de 1250 vers 5010.
const { prisma } = require("./prisma");
const { prochainNumero, prochainNumeroClient, creerAvecNumero } = require("./numerotation");
const { enregistrerEcriture, assurerPlanComptable } = require("./comptabilite");

// Mode de paiement d'une facture de bon interne — jamais offert dans les
// listes de paiement (lib/modesPaiement.js)
const MODE_PAIEMENT_COUTANT = "COUTANT_VEHICULE";

const COMPTE_VEHICULES = "1250";
const COMPTE_VENTE_VEHICULES = "4500"; // loin de la suite 4070, 4080… des postes créés à la main
const COMPTE_COUT_VEHICULES = "5010";
const CODE_CATEGORIE_ACHAT = "VEHICULE_A_VENDRE";

const CLE_CLIENT_INTERNE = "client_vehicules_a_vendre";
const NOM_CLIENT_INTERNE = "Véhicules à vendre (interne)";

function prochainNumeroVehiculeVente() {
  return prochainNumero(prisma.vehiculeVente, "numero", "VAV");
}

function prochainNumeroFactureVente() {
  return prochainNumero(prisma.factureVente, "numero", "VTE");
}

// Comptes et poste de dépense propres aux véhicules à vendre (idempotent,
// comme assurerPlanComptable) — l'achat d'un véhicule se saisit comme une
// facture fournisseur sur le poste « Achat de véhicule à vendre », qui
// débite l'actif 1250 plutôt qu'une dépense.
async function assurerComptesVehiculesAVendre() {
  await assurerPlanComptable();
  const comptes = [
    { numero: COMPTE_VEHICULES, nom: "Véhicules à vendre", type: "ACTIF" },
    { numero: COMPTE_VENTE_VEHICULES, nom: "Vente de véhicules", type: "REVENU" },
    { numero: COMPTE_COUT_VEHICULES, nom: "Coût des véhicules vendus", type: "DEPENSE", typeCharge: "VARIABLE" },
  ];
  for (const c of comptes) {
    await prisma.compte.upsert({ where: { numero: c.numero }, update: {}, create: c });
  }
  await prisma.categorieDepense.upsert({
    where: { code: CODE_CATEGORIE_ACHAT },
    update: {},
    create: { code: CODE_CATEGORIE_ACHAT, nom: "Achat de véhicule à vendre (actif)", compteDepenseNumero: COMPTE_VEHICULES },
  });
}

// Client interne qui « possède » les véhicules à vendre — créé au premier
// besoin, retrouvé ensuite par son id gardé dans les paramètres.
async function obtenirClientInterne() {
  const param = await prisma.parametre.findUnique({ where: { cle: CLE_CLIENT_INTERNE } });
  if (param?.valeur) {
    const client = await prisma.client.findUnique({ where: { id: param.valeur } });
    if (client) return client;
  }
  const client = await creerAvecNumero(prochainNumeroClient, (numero) => prisma.client.create({ data: { numero, nom: NOM_CLIENT_INTERNE } }));
  await prisma.parametre.upsert({
    where: { cle: CLE_CLIENT_INTERNE },
    update: { valeur: client.id },
    create: { cle: CLE_CLIENT_INTERNE, valeur: client.id },
  });
  return client;
}

// Montant d'un bon interne ajouté au coûtant : sa facture, avant taxes
// (il n'y en a pas). Un bon pas encore facturé n'ajoute rien.
function montantBon(bon) {
  return bon.facture && bon.facture.statut !== "ANNULEE" ? bon.facture.totalFacture : 0;
}

// Coûtant total = achat + bons facturés. Une fois vendu, c'est le coûtant
// figé sur la facture de vente qui fait foi.
function coutantTotal(vv) {
  if (vv.factureVente) return vv.factureVente.coutantVehicule;
  return (vv.coutantAchat || 0) + (vv.bons || []).reduce((s, b) => s + montantBon(b), 0);
}

// Champs de la fiche (hors véhicule) envoyés par le formulaire → { data }
// prêt pour Prisma, ou { erreur }. Seuls les champs présents sont repris.
function normaliserFiche(e) {
  const data = {};
  const montant = (v) => Number(String(v ?? "").replace(",", ".").replace(/\s/g, "") || 0);
  for (const champ of ["coutantAchat", "prixDemande"]) {
    if (e[champ] === undefined) continue;
    const n = montant(e[champ]);
    if (!Number.isFinite(n) || n < 0) return { erreur: champ === "coutantAchat" ? "Coûtant d'achat invalide." : "Prix demandé invalide." };
    data[champ] = Math.round(n * 100) / 100;
  }
  if (e.kilometrage !== undefined) {
    const texte = String(e.kilometrage ?? "").replace(/\s/g, "");
    const km = texte ? Number(texte) : null;
    if (km !== null && (!Number.isInteger(km) || km < 0)) return { erreur: "Kilométrage invalide." };
    data.kilometrage = km;
  }
  if (e.dateAchat !== undefined) {
    if (e.dateAchat && !/^\d{4}-\d{2}-\d{2}$/.test(e.dateAchat)) return { erreur: "Date d'achat invalide." };
    // Midi UTC : la même journée au Québec, quel que soit le fuseau
    data.dateAchat = e.dateAchat ? new Date(`${e.dateAchat}T12:00:00Z`) : null;
  }
  for (const champ of ["provenance", "description"]) {
    if (e[champ] !== undefined) data[champ] = String(e[champ] ?? "").trim().slice(0, champ === "description" ? 4000 : 200) || null;
  }
  return { data };
}

async function moduleComptabiliteActif() {
  const p = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  return p?.valeur !== "inactif";
}

// Facture d'un bon interne « payée » par le coûtant du véhicule. Même
// source que l'encaissement d'une facture (FACTURE_PAYEE) : annuler la
// facture retire aussi cette écriture.
async function posterCapitalisationBon(facture, vv, creePar) {
  if (facture.totalAvecTaxes <= 0.005 || !(await moduleComptabiliteActif())) return;
  await assurerComptesVehiculesAVendre();
  const description = `Facture ${facture.numero} ajoutée au coûtant du véhicule ${vv.numero}`;
  await enregistrerEcriture({
    date: facture.datePaiement || facture.dateEmission,
    description,
    source: "FACTURE_PAYEE",
    sourceId: facture.id,
    lignes: [
      { compteNumero: COMPTE_VEHICULES, debit: facture.totalAvecTaxes, description },
      { compteNumero: "1100", credit: facture.totalAvecTaxes, description },
    ],
    creePar,
  });
}

async function posterVenteEmise(fv, vv, creePar) {
  if (!(await moduleComptabiliteActif())) return;
  await assurerComptesVehiculesAVendre();
  const d = `Vente ${fv.numero} — véhicule ${vv.numero}`;
  const lignes = [
    { compteNumero: "1100", debit: fv.totalAvecTaxes, description: d },
    { compteNumero: COMPTE_VENTE_VEHICULES, credit: fv.prixVente, description: d },
  ];
  if (fv.tpsMontant > 0) lignes.push({ compteNumero: "2000", credit: fv.tpsMontant, description: d });
  if (fv.tvqMontant > 0) lignes.push({ compteNumero: "2010", credit: fv.tvqMontant, description: d });
  if (fv.coutantVehicule > 0.005) {
    lignes.push({ compteNumero: COMPTE_COUT_VEHICULES, debit: fv.coutantVehicule, description: `Coûtant — ${d}` });
    lignes.push({ compteNumero: COMPTE_VEHICULES, credit: fv.coutantVehicule, description: `Coûtant — ${d}` });
  }
  await enregistrerEcriture({ date: fv.dateEmission, description: `${d} émise`, source: "VENTE_VEHICULE_EMISE", sourceId: fv.id, lignes, creePar });
}

async function posterVentePayee(fv, compteNumero, modePaiement, creePar) {
  if (!(await moduleComptabiliteActif())) return;
  await assurerPlanComptable();
  const { LABEL_MODE_PAIEMENT } = require("./modesPaiement");
  const suffixe = modePaiement && LABEL_MODE_PAIEMENT[modePaiement] ? ` — ${LABEL_MODE_PAIEMENT[modePaiement]}` : "";
  const reference = fv.referenceVersement ? ` (réf. ${fv.referenceVersement})` : "";
  await enregistrerEcriture({
    date: fv.datePaiement || new Date(),
    description: `Vente ${fv.numero} payée${suffixe}${reference}`,
    source: "VENTE_VEHICULE_PAYEE",
    sourceId: fv.id,
    lignes: [
      { compteNumero, debit: fv.totalAvecTaxes, description: `Vente ${fv.numero}` },
      { compteNumero: "1100", credit: fv.totalAvecTaxes, description: `Vente ${fv.numero}` },
    ],
    creePar,
  });
}

module.exports = {
  MODE_PAIEMENT_COUTANT, COMPTE_VEHICULES, COMPTE_VENTE_VEHICULES, COMPTE_COUT_VEHICULES,
  prochainNumeroVehiculeVente, prochainNumeroFactureVente,
  assurerComptesVehiculesAVendre, obtenirClientInterne, montantBon, coutantTotal, normaliserFiche,
  posterCapitalisationBon, posterVenteEmise, posterVentePayee,
};
