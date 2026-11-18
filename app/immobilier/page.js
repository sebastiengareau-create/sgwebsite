import { prisma } from "@/lib/prisma";
import EnTete from "../components/EnTete";
import { soldesDesBaux, donneesRendement } from "@/lib/immobilier";
import { periodeCourante, STATUTS_REPARATION_OUVERTS } from "@/lib/immobilierCalculs";
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

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <TableauBordClient {...simple({ immeubles, soldes, reparations, documents, bauxFactures: loyersDuMois.map((c) => c.bailId), nbLocataires, donnees, periode })} />
    </div>
  );
}
