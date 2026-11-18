import { prisma } from "@/lib/prisma";
import EnTete from "../components/EnTete";
import { soldesDesBaux, donneesRendement } from "@/lib/immobilier";
import { periodeCourante, STATUTS_REPARATION_OUVERTS, bailAu31Decembre } from "@/lib/immobilierCalculs";
import { exigerAccesImmo, simple } from "./acces";
import TableauBordClient from "./TableauBordClient";

export default async function TableauBordImmo() {
  const session = await exigerAccesImmo();
  const periode = periodeCourante();
  const annee = Number(periode.slice(0, 4));
  const [immeubles, soldes, reparations, documents, loyersDuMois, nbLocataires, donnees] = await Promise.all([
    prisma.immeubleImmo.findMany({
      select: {
        id: true, nom: true, type: true, valeurEstimee: true, soldeHypotheque: true,
        logements: {
          select: {
            id: true, numero: true, type: true, loyerVise: true, immeubleId: true,
            baux: { where: { statut: "ACTIF" }, select: { id: true, logementId: true, dateDebut: true, dateFin: true, loyer: true, statut: true, avisEnvoyeLe: true, reponseAvis: true, nouveauLoyer: true, locataires: { select: { id: true, nom: true } } } },
          },
        },
      },
      orderBy: { nom: "asc" },
    }),
    soldesDesBaux(),
    prisma.reparationImmo.findMany({
      where: { statut: { in: STATUTS_REPARATION_OUVERTS } },
      select: { id: true, numero: true, titre: true, priorite: true, statut: true, creeLe: true, entrepreneur: true, coutEstime: true, coutReel: true, datePrevue: true, immeuble: { select: { nom: true } }, logement: { select: { numero: true, type: true } } },
      orderBy: { creeLe: "desc" },
    }),
    prisma.documentImmo.findMany({ where: { expireLe: { not: null } }, select: { id: true, titre: true, categorie: true, expireLe: true, immeuble: { select: { nom: true } } }, orderBy: { expireLe: "asc" } }),
    prisma.chargeImmo.findMany({ where: { periode, type: "LOYER" }, select: { bailId: true } }),
    prisma.locataireImmo.count(),
    donneesRendement(annee),
  ]);

  // Relevés 31 : de janvier à mars, ceux de l'année écoulée ; en décembre, ceux à préparer
  const mois = Number(periode.slice(5, 7));
  let releve31 = null;
  if (mois <= 3 || mois === 12) {
    const anneeRl = mois === 12 ? annee : annee - 1;
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
      <TableauBordClient releve31={releve31} {...simple({ immeubles, soldes, reparations, documents, bauxFactures: loyersDuMois.map((c) => c.bailId), nbLocataires, donnees, periode })} />
    </div>
  );
}
