const { prisma } = require("./prisma");

const NORMAL_DEBIT = ["ACTIF", "DEPENSE"]; // même convention que app/gerant/comptabilite/page.js

// Comptes de trésorerie créés par défaut — reliés aux comptes GL ajoutés dans
// PLAN_COMPTABLE_STANDARD (lib/comptabilite.js).
// Pas de marge de crédit ni de cartes de crédit par défaut — les dépenses
// payées par carte sont gérées comme des comptes à payer normaux (voir
// app/gerant/comptabilite/comptes-a-payer), pas comme un compte de trésorerie
// distinct à suivre.
const COMPTES_TRESORERIE_DEFAUT = [
  { nom: "Petite caisse", categorie: "CAISSE", compteNumero: "1010", ordre: 1 },
  { nom: "Compte bancaire principal", categorie: "BANQUE", compteNumero: "1000", ordre: 2 },
];

// Crée les comptes de trésorerie par défaut manquants (idempotent — jamais de
// doublon, identifié par le compte GL déjà relié) — même principe que
// assurerPlanComptable().
async function assurerComptesTresorerie() {
  const { assurerPlanComptable } = require("./comptabilite");
  await assurerPlanComptable();
  for (const c of COMPTES_TRESORERIE_DEFAUT) {
    const compte = await prisma.compte.findUnique({ where: { numero: c.compteNumero } });
    if (!compte) continue;
    await prisma.compteTresorerie.upsert({
      where: { compteId: compte.id },
      update: {},
      create: { nom: c.nom, categorie: c.categorie, compteId: compte.id, ordre: c.ordre },
    });
  }
}

function calculerSoldeCompte(compte) {
  const totalDebit = compte.lignes.reduce((s, l) => s + l.debit, 0);
  const totalCredit = compte.lignes.reduce((s, l) => s + l.credit, 0);
  return NORMAL_DEBIT.includes(compte.type) ? totalDebit - totalCredit : totalCredit - totalDebit;
}

// Charge les comptes de trésorerie avec leur solde comptable (dérivé des
// écritures, comme le plan comptable) et l'écart avec le dernier solde relevé.
async function obtenirComptesTresorerieAvecSoldes({ actifSeulement = true } = {}) {
  const comptesTresorerie = await prisma.compteTresorerie.findMany({
    where: actifSeulement ? { actif: true } : {},
    include: { compte: { include: { lignes: true } } },
    orderBy: { ordre: "asc" },
  });

  return comptesTresorerie.map((ct) => {
    const soldeComptable = calculerSoldeCompte(ct.compte);
    return {
      id: ct.id,
      nom: ct.nom,
      categorie: ct.categorie,
      actif: ct.actif,
      compteGlId: ct.compte.id,
      compteNumero: ct.compte.numero,
      compteNom: ct.compte.nom,
      compteType: ct.compte.type,
      soldeComptable,
      soldeReleve: ct.soldeReleve,
      soldeReleveLe: ct.soldeReleveLe,
      ecart: ct.soldeReleve - soldeComptable,
    };
  });
}

// Regroupe les soldes par catégorie pour le tableau de bord — la marge de
// crédit est classée "Banque" (comme choisi par le gérant), pas "Cartes de
// crédit" : Liquidités disponibles = Caisse + Banque − Cartes de crédit.
function obtenirResumeTresorerie(comptes) {
  const parCategorie = (cat) => comptes.filter((c) => c.categorie === cat).reduce((s, c) => s + c.soldeComptable, 0);
  const caisse = parCategorie("CAISSE");
  const banque = parCategorie("BANQUE");
  const cartesCredit = parCategorie("CARTE_CREDIT");
  return { caisse, banque, cartesCredit, liquidites: caisse + banque - cartesCredit };
}

// Liste légère (pas de calcul de solde) pour peupler les menus déroulants
// des formulaires de paiement (facture/dépense) — trié comme le tableau de
// bord, avec le numéro du compte GL relié pour la comptabilisation.
async function obtenirComptesTresoreriePourSelection() {
  const comptes = await prisma.compteTresorerie.findMany({
    where: { actif: true },
    select: { id: true, nom: true, categorie: true, compte: { select: { numero: true } } },
    orderBy: { ordre: "asc" },
  });
  return comptes.map((c) => ({ id: c.id, nom: c.nom, categorie: c.categorie, compteNumero: c.compte.numero }));
}

module.exports = {
  assurerComptesTresorerie,
  obtenirComptesTresorerieAvecSoldes,
  obtenirResumeTresorerie,
  obtenirComptesTresoreriePourSelection,
  COMPTES_TRESORERIE_DEFAUT,
};
