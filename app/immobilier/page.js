import { prisma } from "@/lib/prisma";
import EnTete from "../components/EnTete";
import { comptesDesBaux, donneesRendement } from "@/lib/immobilier";
import { lireReglagesImmoAuto, dernierResultatImmoAuto } from "@/lib/immobilierAuto";
import { periodeCourante, STATUTS_REPARATION_OUVERTS, bailAu31Decembre, ajouterMois } from "@/lib/immobilierCalculs";
import { exigerAccesImmo, simple } from "./acces";
import TableauBordClient from "./TableauBordClient";

// Les 12 derniers mois, du plus ancien au mois courant : « 2025-12 » … « 2026-11 »
function douzeMois(periode) {
  const [a, m] = periode.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => ajouterMois(new Date(Date.UTC(a, m - 1, 15, 12)), i - 11).toISOString().slice(0, 7));
}

export default async function TableauBordImmo() {
  const session = await exigerAccesImmo();
  const periode = periodeCourante();
  const annee = Number(periode.slice(0, 4));
  const mois = douzeMois(periode);
  const [a0, m0] = mois[0].split("-").map(Number);
  const [immeubles, comptes, reparations, documents, loyersDuMois, nbLocataires, donnees, loyersParMois, paiementsRecents, reglagesAuto, dernierAuto] = await Promise.all([
    prisma.immeubleImmo.findMany({
      select: {
        id: true, nom: true, type: true, valeurEstimee: true, soldeHypotheque: true,
        logements: {
          select: {
            id: true, numero: true, type: true, loyerVise: true, immeubleId: true,
            baux: {
              where: { statut: "ACTIF" },
              select: {
                id: true, logementId: true, dateDebut: true, dateFin: true, loyer: true, statut: true, avisEnvoyeLe: true, reponseAvis: true, reponseAvisLe: true, nouveauLoyer: true,
                locataires: { select: { id: true, nom: true } },
              },
            },
          },
        },
      },
      orderBy: { nom: "asc" },
    }),
    comptesDesBaux(),
    prisma.reparationImmo.findMany({
      where: { statut: { in: STATUTS_REPARATION_OUVERTS } },
      select: { id: true, numero: true, source: true, titre: true, priorite: true, statut: true, creeLe: true, entrepreneur: true, coutEstime: true, coutReel: true, datePrevue: true, immeuble: { select: { nom: true } }, logement: { select: { numero: true, type: true } } },
      orderBy: { creeLe: "desc" },
    }),
    prisma.documentImmo.findMany({ where: { expireLe: { not: null } }, select: { id: true, titre: true, categorie: true, expireLe: true, immeuble: { select: { nom: true } } }, orderBy: { expireLe: "asc" } }),
    prisma.chargeImmo.findMany({ where: { periode, type: "LOYER" }, select: { bailId: true, montant: true } }),
    prisma.locataireImmo.count(),
    donneesRendement(annee),
    // Graphique : loyers facturés (par mois de loyer) et paiements reçus (par date)
    prisma.chargeImmo.groupBy({ by: ["periode"], where: { type: "LOYER", periode: { in: mois } }, _sum: { montant: true } }),
    prisma.paiementImmo.findMany({ where: { date: { gte: new Date(Date.UTC(a0, m0 - 1, 1)) } }, select: { date: true, montant: true } }),
    lireReglagesImmoAuto(),
    dernierResultatImmoAuto(),
  ]);

  const facture = Object.fromEntries(loyersParMois.map((l) => [l.periode, l._sum.montant || 0]));
  const percu = {};
  for (const p of paiementsRecents) {
    const cle = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(p.date).slice(0, 7);
    percu[cle] = (percu[cle] || 0) + p.montant;
  }
  const serie = mois.map((cle) => ({ cle, facture: Math.round((facture[cle] || 0) * 100) / 100, percu: Math.round((percu[cle] || 0) * 100) / 100 }));

  // Relevés 31 : de janvier à mars, ceux de l'année écoulée ; en décembre, ceux à préparer
  const moisCourant = Number(periode.slice(5, 7));
  let releve31 = null;
  if (moisCourant <= 3 || moisCourant === 12) {
    const anneeRl = moisCourant === 12 ? annee : annee - 1;
    const baux31 = await prisma.bailImmo.findMany({
      where: { dateDebut: { lte: new Date(Date.UTC(anneeRl, 11, 31, 23)) }, OR: [{ dateFin: null }, { dateFin: { gte: new Date(Date.UTC(anneeRl, 11, 31)) } }], logement: { type: "LOGEMENT" } },
      select: { dateDebut: true, dateFin: true, terminaisonLe: true, releves31: { where: { annee: anneeRl }, select: { produitLe: true } } },
    });
    const vises = baux31.filter((b) => bailAu31Decembre(b, anneeRl));
    releve31 = { annee: anneeRl, total: vises.length, aProduire: vises.filter((b) => !b.releves31[0]?.produitLe).length };
  }

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <TableauBordClient
        releve31={releve31}
        courriel={Boolean(process.env.RESEND_API_KEY)}
        {...simple({
          immeubles, comptes, reparations, documents, nbLocataires, donnees, periode, serie, reglagesAuto, dernierAuto,
          bauxFactures: loyersDuMois.map((c) => c.bailId),
        })}
      />
    </div>
  );
}
