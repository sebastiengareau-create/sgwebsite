import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { exigerAccesImmo, simple, FICHIER_SANS_DONNEES } from "../../acces";
import ReparationClient from "./ReparationClient";

export default async function FicheReparation(props) {
  const { id } = await props.params;
  const session = await exigerAccesImmo();
  const reparation = await prisma.reparationImmo.findUnique({
    where: { id },
    include: {
      immeuble: { select: { id: true, nom: true, logements: { select: { id: true, numero: true, type: true }, orderBy: { numero: "asc" } } } },
      logement: { select: { id: true, numero: true, type: true } },
      locataire: { select: { id: true, nom: true, telephone: true } },
      fichiers: { select: FICHIER_SANS_DONNEES, orderBy: { creeLe: "asc" } },
    },
  });
  if (!reparation) notFound();
  const locataires = await prisma.locataireImmo.findMany({
    where: { OR: [{ baux: { some: { statut: "ACTIF", logement: { immeubleId: reparation.immeubleId } } } }, ...(reparation.locataireId ? [{ id: reparation.locataireId }] : [])] },
    select: { id: true, nom: true }, orderBy: { nom: "asc" },
  });
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ReparationClient {...simple({ reparation, locataires })} />
    </div>
  );
}
