// Liste des bons (Opérations) : la page ne charge que les bons du quotidien
// — tous ceux qui ne sont pas facturés, et ceux facturés ce mois-ci. Les bons
// facturés des mois précédents restent dans leurs dossiers par mois : la page
// n'en reçoit que le nombre, et le contenu d'un dossier est chargé à son
// ouverture (GET /api/bons?mois=…). Sans ça, la page grossirait de tout
// l'historique à chaque visite. La recherche, elle, fouille tout l'historique
// côté serveur (GET /api/bons?recherche=…).
import { prisma } from "./prisma";
import { limitesMoisQuebec } from "./temps";
import { cleMoisQuebec } from "./regroupementDates";

// Seulement ce qu'affichent les cartes de la liste (ListeBonsClient)
export const CHAMPS_LISTE_BONS = {
  id: true, numero: true, statut: true, datePrevue: true, creeLe: true,
  client: { select: { nom: true } },
  facture: { select: { dateEmission: true } },
  problemes: {
    orderBy: { id: "asc" },
    select: { id: true, description: true, pieces: { select: { id: true, bo: true, piece: { select: { nom: true } } } } },
  },
};

export const LIMITE_RECHERCHE_BONS = 100;

// Un bon facturé est classé au mois de sa facture (à défaut : sa date
// prévue, sinon sa création — même règle que dateFacturation côté liste).
function factureEntre(periode) {
  return {
    statut: "TERMINE",
    OR: [
      { facture: { is: { dateEmission: periode } } },
      { facture: { is: null }, datePrevue: periode },
      { facture: { is: null }, datePrevue: null, creeLe: periode },
    ],
  };
}

function debutMoisCourant() {
  const [an, mois] = cleMoisQuebec(new Date()).split("-").map(Number);
  return limitesMoisQuebec(an, mois).debut;
}

// Bons chargés avec la page : non facturés, ou facturés ce mois-ci
export function bonsDuQuotidien() {
  return prisma.bonTravail.findMany({
    where: { OR: [{ statut: { not: "TERMINE" } }, factureEntre({ gte: debutMoisCourant() })] },
    select: CHAMPS_LISTE_BONS,
    orderBy: { creeLe: "desc" },
  });
}

// Mois précédents qui ont des bons facturés : [{ cle: "2026-03", nombre }],
// le plus récent en premier
export async function moisAnciensBons() {
  const avant = { lt: debutMoisCourant() };
  const [factures, sansFacture] = await Promise.all([
    prisma.facture.findMany({ where: { bon: { statut: "TERMINE" }, dateEmission: avant }, select: { dateEmission: true } }),
    prisma.bonTravail.findMany({
      where: { statut: "TERMINE", facture: { is: null }, OR: [{ datePrevue: avant }, { datePrevue: null, creeLe: avant }] },
      select: { datePrevue: true, creeLe: true },
    }),
  ]);
  const nombres = new Map();
  const compter = (date) => {
    const cle = cleMoisQuebec(date);
    nombres.set(cle, (nombres.get(cle) || 0) + 1);
  };
  factures.forEach((f) => compter(f.dateEmission));
  sansFacture.forEach((b) => compter(b.datePrevue || b.creeLe));
  return [...nombres.keys()].sort().reverse().map((cle) => ({ cle, nombre: nombres.get(cle) }));
}

// Bons facturés d'un mois ("YYYY-MM"), pour l'ouverture de son dossier
export function bonsFacturesDuMois(cleMois) {
  const [an, mois] = cleMois.split("-").map(Number);
  const { debut, fin } = limitesMoisQuebec(an, mois);
  return prisma.bonTravail.findMany({
    where: factureEntre({ gte: debut, lte: fin }),
    select: CHAMPS_LISTE_BONS,
    orderBy: { creeLe: "desc" },
  });
}

// Recherche par numéro ou nom du client, dans tout l'historique
export async function rechercherBons(texte) {
  const q = texte.trim();
  const bons = await prisma.bonTravail.findMany({
    where: { OR: [{ numero: { contains: q, mode: "insensitive" } }, { client: { nom: { contains: q, mode: "insensitive" } } }] },
    select: CHAMPS_LISTE_BONS,
    orderBy: { creeLe: "desc" },
    take: LIMITE_RECHERCHE_BONS + 1,
  });
  return { bons: bons.slice(0, LIMITE_RECHERCHE_BONS), tronque: bons.length > LIMITE_RECHERCHE_BONS };
}
