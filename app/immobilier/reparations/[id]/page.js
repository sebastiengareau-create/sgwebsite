import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { lienComptaActif, statutsFactures, ORIGINE_REPARATION } from "@/lib/immobilierCompta";
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
  // Immobilier relié à la comptabilité : entrepreneur choisi parmi les
  // fournisseurs, facture aux comptes à payer une fois terminée
  const compta = await lienComptaActif();
  const [fournisseurs, statuts] = compta
    ? await Promise.all([
      prisma.fournisseur.findMany({ where: { OR: [{ actif: true }, ...(reparation.fournisseurId ? [{ id: reparation.fournisseurId }] : [])] }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
      statutsFactures(ORIGINE_REPARATION, [reparation.id]),
    ])
    : [null, {}];
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ReparationClient {...simple({ reparation, locataires, fournisseurs, facture: statuts[reparation.id] || null })} />
    </div>
  );
}
