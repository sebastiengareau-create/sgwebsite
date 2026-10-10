// Avis qui ne viennent pas d'un geste dans l'appli, mais d'une vérification
// régulière (lib/planificateurSauvegarde.js, une fois par heure) : pièces
// sous le seuil et comptes à payer bientôt dus. Chaque pièce ou facture
// n'est annoncée qu'une fois — la liste de ce qui a déjà été annoncé est
// gardée dans Parametre. Pas d'avis la nuit : seulement de 7 h à 20 h.
const { prisma } = require("./prisma");
const { notifier } = require("./notifications");
const { dateAujourdhuiQuebec, limitesJourQuebec, FUSEAU } = require("./temps");

const CLE_STOCK_AVISE = "notif_stock_bas_avises";
const CLE_ECHEANCES_AVISEES = "notif_echeances_avisees";
const JOURS_AVANT_ECHEANCE = 3;
const JOURS_CONSERVATION = 60;

function heureQuebec() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: FUSEAU, hour: "numeric", hourCycle: "h23" }).format(new Date()));
}

async function lireListe(cle) {
  const p = await prisma.parametre.findUnique({ where: { cle } });
  return new Set((p?.valeur || "").split(",").filter(Boolean));
}
async function ecrireListe(cle, ids) {
  const valeur = [...ids].join(",");
  await prisma.parametre.upsert({ where: { cle }, update: { valeur }, create: { cle, valeur } });
}

function resumeListe(lignes, max = 5) {
  return lignes.slice(0, max).join(" · ") + (lignes.length > max ? ` (+${lignes.length - max} autres)` : "");
}

// Pièces actives à leur seuil minimum (réglé, donc > 0) ou sous lui, sans
// assez en commande — brouillons compris — pour le dépasser
async function verifierStockBas() {
  const pieces = await prisma.piece.findMany({
    where: { actif: true, qteMin: { gt: 0 } },
    select: { id: true, nom: true, numero: true, qte: true, qteMin: true },
  });
  const sous = pieces.filter((p) => p.qte <= p.qteMin);
  const lignes = await prisma.ligneCommandeFournisseur.findMany({
    where: { pieceId: { in: sous.map((p) => p.id) }, commande: { statut: { in: ["BROUILLON", "ENVOYEE", "RECUE_PARTIELLE"] } } },
    select: { pieceId: true, qteCommandee: true, qteRecue: true },
  });
  const enCommande = {};
  for (const l of lignes) enCommande[l.pieceId] = (enCommande[l.pieceId] || 0) + Math.max(0, l.qteCommandee - l.qteRecue);
  const aAviser = sous.filter((p) => p.qte + (enCommande[p.id] || 0) <= p.qteMin);

  const dejaAvisees = await lireListe(CLE_STOCK_AVISE);
  const nouvelles = aAviser.filter((p) => !dejaAvisees.has(p.id));
  if (nouvelles.length > 0) {
    await notifier("STOCK_BAS", {
      titre: nouvelles.length === 1 ? "📉 Pièce sous le seuil" : `📉 ${nouvelles.length} pièces sous le seuil`,
      corps: resumeListe(nouvelles.map((p) => `${p.nom} (${p.qte}/${p.qteMin})`)),
      url: "/secretaire/inventaire",
      tag: "stock-bas",
    });
  }
  // Une pièce remontée au-dessus du seuil sort de la liste : elle sera
  // annoncée de nouveau si elle redescend
  await ecrireListe(CLE_STOCK_AVISE, aAviser.map((p) => p.id));
}

// Factures fournisseur impayées dues d'ici JOURS_AVANT_ECHEANCE jours (ou
// déjà en retard)
async function verifierComptesAPayer() {
  const moduleCompta = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleCompta?.valeur === "inactif") return;

  const [an, mois, jour] = dateAujourdhuiQuebec().split("-").map(Number);
  const limite = new Date(Date.UTC(an, mois - 1, jour + JOURS_AVANT_ECHEANCE)).toISOString().slice(0, 10);
  const depenses = await prisma.depense.findMany({
    where: { statut: "IMPAYEE", dateEcheance: { not: null, lte: limitesJourQuebec(limite).fin } },
    include: { fournisseur: { select: { nom: true } } },
    orderBy: { dateEcheance: "asc" },
  });

  const dejaAvisees = await lireListe(CLE_ECHEANCES_AVISEES);
  const nouvelles = depenses.filter((d) => !dejaAvisees.has(d.id));
  if (nouvelles.length > 0) {
    const format = new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", day: "numeric", month: "short" });
    const argent = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });
    await notifier("COMPTE_A_PAYER", {
      titre: nouvelles.length === 1 ? "💵 Compte à payer bientôt dû" : `💵 ${nouvelles.length} comptes à payer bientôt dus`,
      corps: resumeListe(nouvelles.map((d) => `${d.fournisseur.nom} — ${argent.format(d.montant)}, dû le ${format.format(d.dateEcheance)}`)),
      url: "/gerant/comptabilite/comptes-a-payer",
      tag: "comptes-a-payer",
    });
  }
  await ecrireListe(CLE_ECHEANCES_AVISEES, depenses.map((d) => d.id));
}

async function verifierNotificationsPeriodiques() {
  const limite = new Date(Date.now() - JOURS_CONSERVATION * 24 * 3600 * 1000);
  await prisma.notification.deleteMany({ where: { creeLe: { lt: limite } } });

  const heure = heureQuebec();
  if (heure < 7 || heure >= 20) return;
  await verifierStockBas();
  await verifierComptesAPayer();
}

module.exports = { verifierNotificationsPeriodiques };
