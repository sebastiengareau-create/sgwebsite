// Liste des factures (Opérations → Factures) : même principe que la liste des
// bons (lib/listeBons.js). La page ne charge que les factures impayées (toutes,
// peu importe leur âge — c'est la liste de travail) et celles émises ce mois-ci.
// Les mois précédents restent dans leurs dossiers : la page n'en reçoit que
// le nombre et le total par statut, et le contenu d'un dossier est chargé à
// son ouverture (GET /api/factures?mois=…). La recherche fouille tout
// l'historique côté serveur (GET /api/factures?recherche=…).
import { prisma } from "./prisma";
import { limitesMoisQuebec } from "./temps";
import { cleMoisQuebec } from "./regroupementDates";

// Seulement ce qu'affichent les cartes de la liste (FacturesClient)
const CHAMPS_LISTE_FACTURES = {
  id: true, numero: true, statut: true, dateEmission: true, totalAvecTaxes: true, montantPaye: true, referenceVersement: true, modePaiement: true,
  bon: { select: { id: true, numero: true, clientNomAffiche: true, client: { select: { nom: true } } } },
};

const LIMITE_RECHERCHE_FACTURES = 100;

function debutMoisCourant() {
  const [an, mois] = cleMoisQuebec(new Date()).split("-").map(Number);
  return limitesMoisQuebec(an, mois).debut;
}

// Factures chargées avec la page : impayées, ou émises ce mois-ci
export function facturesDuQuotidien() {
  return prisma.facture.findMany({
    where: { OR: [{ statut: "IMPAYEE" }, { dateEmission: { gte: debutMoisCourant() } }] },
    select: CHAMPS_LISTE_FACTURES,
    orderBy: { dateEmission: "desc" },
  });
}

// Nombre total de factures et total payé (paiements partiels compris), tout l'historique
export async function totauxFactures() {
  const parStatut = await prisma.facture.groupBy({ by: ["statut"], _count: true, _sum: { totalAvecTaxes: true, montantPaye: true } });
  return {
    nombre: parStatut.reduce((s, g) => s + g._count, 0),
    totalPaye: parStatut.filter((g) => g.statut !== "ANNULEE").reduce((s, g) => s + (g._sum.montantPaye || 0), 0),
  };
}

// Mois précédents qui ont des factures, le plus récent en premier :
// [{ cle: "2026-03", statuts: { PAYEE: { nombre, total }, … } }]
export async function moisAnciensFactures() {
  const factures = await prisma.facture.findMany({
    where: { dateEmission: { lt: debutMoisCourant() } },
    select: { dateEmission: true, statut: true, totalAvecTaxes: true },
  });
  const parMois = new Map();
  for (const f of factures) {
    const cle = cleMoisQuebec(f.dateEmission);
    if (!parMois.has(cle)) parMois.set(cle, {});
    const statuts = parMois.get(cle);
    statuts[f.statut] ||= { nombre: 0, total: 0 };
    statuts[f.statut].nombre += 1;
    statuts[f.statut].total += f.totalAvecTaxes;
  }
  return [...parMois.keys()].sort().reverse().map((cle) => ({ cle, statuts: parMois.get(cle) }));
}

// Factures d'un mois ("YYYY-MM"), tous statuts, pour l'ouverture de son dossier
export function facturesDuMois(cleMois) {
  const [an, mois] = cleMois.split("-").map(Number);
  const { debut, fin } = limitesMoisQuebec(an, mois);
  return prisma.facture.findMany({
    where: { dateEmission: { gte: debut, lte: fin } },
    select: CHAMPS_LISTE_FACTURES,
    orderBy: { dateEmission: "desc" },
  });
}

// Recherche par numéro de facture, numéro de bon ou nom du client, dans tout l'historique
export async function rechercherFactures(texte) {
  const q = texte.trim();
  const contient = { contains: q, mode: "insensitive" };
  const factures = await prisma.facture.findMany({
    where: { OR: [{ numero: contient }, { bon: { numero: contient } }, { bon: { client: { nom: contient } } }, { bon: { clientNomAffiche: contient } }] },
    select: CHAMPS_LISTE_FACTURES,
    orderBy: { dateEmission: "desc" },
    take: LIMITE_RECHERCHE_FACTURES + 1,
  });
  return { factures: factures.slice(0, LIMITE_RECHERCHE_FACTURES), tronque: factures.length > LIMITE_RECHERCHE_FACTURES };
}
