const { prisma } = require("./prisma");

const NORMAL_DEBIT = ["ACTIF", "DEPENSE"]; // même convention que app/gerant/comptabilite/page.js

// Comptes de trésorerie créés par défaut — reliés aux comptes GL ajoutés dans
// PLAN_COMPTABLE_STANDARD (lib/comptabilite.js). D'autres comptes sont
// ajoutables depuis l'écran "Comptes" de Caisse & Banque.
const COMPTES_TRESORERIE_DEFAUT = [
  { nom: "Caisse principale", categorie: "CAISSE", compteNumero: "1010", ordre: 1 },
  { nom: "Compte bancaire principal", categorie: "BANQUE", compteNumero: "1000", ordre: 2 },
  { nom: "Marge de crédit", categorie: "BANQUE", compteNumero: "2110", ordre: 3 },
  { nom: "Visa", categorie: "CARTE_CREDIT", compteNumero: "2120", ordre: 4 },
  { nom: "Mastercard", categorie: "CARTE_CREDIT", compteNumero: "2130", ordre: 5 },
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

// Entrées/sorties du mois en cours + série quotidienne des 30 derniers jours —
// seulement sur les comptes GL de type ACTIF (caisse + banque réelles) : une
// charge sur une carte de crédit ou la marge n'est pas une sortie de
// liquidités tant qu'elle n'est pas payée (ce paiement sortira alors du côté
// banque, et sera compté à ce moment-là).
async function obtenirEntreesSortiesMois(comptes) {
  const { limitesMoisQuebec, limitesJourQuebec, dateAujourdhuiQuebec, dateQuebecStr, joursCalendairesQuebec } = require("./temps");

  const compteGlIds = comptes.filter((c) => c.compteType === "ACTIF").map((c) => c.compteGlId);
  if (compteGlIds.length === 0) return { entreesMois: 0, sortiesMois: 0, serie30Jours: [] };

  const [anneeStr, moisStr] = dateAujourdhuiQuebec().split("-");
  const { debut: debutMois } = limitesMoisQuebec(Number(anneeStr), Number(moisStr));

  const ilYA29Jours = dateQuebecStr(new Date(Date.now() - 29 * 86400000));
  const { debut: debut30Jours } = limitesJourQuebec(ilYA29Jours);

  const lignes = await prisma.ligneEcriture.findMany({
    where: { compteId: { in: compteGlIds }, ecriture: { date: { gte: debut30Jours } } },
    include: { ecriture: { select: { date: true } } },
  });

  const parJour = {};
  for (const j of joursCalendairesQuebec(debut30Jours, new Date())) {
    parJour[j.dateStr] = { dateStr: j.dateStr, entrees: 0, sorties: 0 };
  }

  let entreesMois = 0;
  let sortiesMois = 0;
  for (const l of lignes) {
    const jourStr = dateQuebecStr(l.ecriture.date);
    if (parJour[jourStr]) {
      parJour[jourStr].entrees += l.debit;
      parJour[jourStr].sorties += l.credit;
    }
    if (l.ecriture.date >= debutMois) {
      entreesMois += l.debit;
      sortiesMois += l.credit;
    }
  }

  return { entreesMois, sortiesMois, serie30Jours: Object.values(parJour) };
}

// Transactions des 12 derniers mois sur tous les comptes de trésorerie actifs
// — utilisé par la page Transactions, filtrée ensuite côté client.
async function obtenirTransactionsTresorerie(comptes) {
  const compteGlIds = comptes.map((c) => c.compteGlId);
  if (compteGlIds.length === 0) return [];

  const depuis = new Date();
  depuis.setFullYear(depuis.getFullYear() - 1);

  const lignes = await prisma.ligneEcriture.findMany({
    where: { compteId: { in: compteGlIds }, ecriture: { date: { gte: depuis } } },
    include: { ecriture: true, compte: true },
    orderBy: { ecriture: { date: "desc" } },
  });

  const compteTresorerieParGlId = Object.fromEntries(comptes.map((c) => [c.compteGlId, c]));

  return lignes.map((l) => ({
    id: l.id,
    date: l.ecriture.date,
    description: l.ecriture.description,
    numero: l.ecriture.numero,
    source: l.ecriture.source,
    debit: l.debit,
    credit: l.credit,
    compteTresorerieId: compteTresorerieParGlId[l.compteId]?.id,
    compteTresorerieNom: compteTresorerieParGlId[l.compteId]?.nom,
  }));
}

// Déplace de l'argent d'un compte de trésorerie à un autre — jamais traité
// comme un revenu ou une dépense (voir enregistrerEcriture pour le
// verrouillage de période, appliqué ici comme pour toute écriture). La règle
// "crédite la source, débite la destination" reste correcte peu importe le
// type GL des deux comptes (ex : rembourser une carte de crédit depuis la
// banque = crédit Banque + débit Carte, ce qui réduit bien la dette).
async function effectuerTransfert({ compteSourceId, compteDestinationId, montant, description, date, creePar }) {
  if (!compteSourceId || !compteDestinationId) throw new Error("Choisis les deux comptes.");
  if (compteSourceId === compteDestinationId) throw new Error("Le compte source et le compte destination doivent être différents.");
  const montantNum = Number(montant);
  if (!montantNum || montantNum <= 0) throw new Error("Montant invalide.");

  const [source, destination] = await Promise.all([
    prisma.compteTresorerie.findUnique({ where: { id: compteSourceId }, include: { compte: true } }),
    prisma.compteTresorerie.findUnique({ where: { id: compteDestinationId }, include: { compte: true } }),
  ]);
  if (!source || !destination) throw new Error("Compte introuvable.");

  const { enregistrerEcriture } = require("./comptabilite");
  const desc = description?.trim() || `Transfert — ${source.nom} → ${destination.nom}`;

  return enregistrerEcriture({
    date: date ? new Date(date) : new Date(),
    description: desc,
    source: "TRANSFERT",
    lignes: [
      { compteNumero: source.compte.numero, credit: montantNum, description: desc },
      { compteNumero: destination.compte.numero, debit: montantNum, description: desc },
    ],
    creePar,
  });
}

// Historique des transferts (les 2 lignes de chaque écriture "TRANSFERT" sont
// résumées en une seule entrée source → destination).
async function obtenirTransfertsRecents({ limite = 50 } = {}) {
  const ecritures = await prisma.ecritureComptable.findMany({
    where: { source: "TRANSFERT" },
    include: { lignes: { include: { compte: true } } },
    orderBy: { date: "desc" },
    take: limite,
  });

  const comptesTresorerie = await prisma.compteTresorerie.findMany({ select: { id: true, nom: true, compteId: true } });
  const compteTresorerieParGlId = Object.fromEntries(comptesTresorerie.map((c) => [c.compteId, c]));

  return ecritures.map((e) => {
    const ligneSource = e.lignes.find((l) => l.credit > 0);
    const ligneDestination = e.lignes.find((l) => l.debit > 0);
    return {
      id: e.id,
      numero: e.numero,
      date: e.date,
      description: e.description,
      montant: ligneSource?.credit || 0,
      compteSourceNom: compteTresorerieParGlId[ligneSource?.compteId]?.nom || ligneSource?.compte.nom || "?",
      compteDestinationNom: compteTresorerieParGlId[ligneDestination?.compteId]?.nom || ligneDestination?.compte.nom || "?",
    };
  });
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
  obtenirEntreesSortiesMois,
  obtenirTransactionsTresorerie,
  obtenirComptesTresoreriePourSelection,
  effectuerTransfert,
  obtenirTransfertsRecents,
  COMPTES_TRESORERIE_DEFAUT,
};
