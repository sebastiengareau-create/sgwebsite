import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { soldesDesBaux, donneesRendement } from "@/lib/immobilier";
import { periodeCourante } from "@/lib/immobilierCalculs";
import { exigerAccesImmo, simple, DOC_SANS_DONNEES } from "../../acces";
import ImmeubleClient from "./ImmeubleClient";

export default async function FicheImmeuble(props) {
  const { id } = await props.params;
  const session = await exigerAccesImmo();
  const annee = Number(periodeCourante().slice(0, 4));
  const [immeuble, soldes, donnees, locataires] = await Promise.all([
    prisma.immeubleImmo.findUnique({
      where: { id },
      include: {
        logements: {
          include: { baux: { where: { statut: "ACTIF" }, select: { id: true, loyer: true, statut: true, dateDebut: true, dateFin: true, avisEnvoyeLe: true, reponseAvis: true, nouveauLoyer: true, locataires: { select: { id: true, nom: true } } } } },
        },
        depenses: { orderBy: { date: "desc" }, take: 40 },
        reparations: { select: { id: true, numero: true, titre: true, statut: true, priorite: true, entrepreneur: true, coutEstime: true, coutReel: true, creeLe: true, logement: { select: { id: true, numero: true, type: true } } }, orderBy: { creeLe: "desc" } },
        documents: { select: DOC_SANS_DONNEES, orderBy: [{ date: "desc" }, { creeLe: "desc" }] },
      },
    }),
    soldesDesBaux({ bail: { logement: { immeubleId: id } } }),
    donneesRendement(annee),
    prisma.locataireImmo.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  if (!immeuble) notFound();
  immeuble.logements.sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ImmeubleClient {...simple({ immeuble, soldes, donnees, annee, locataires })} />
    </div>
  );
}
