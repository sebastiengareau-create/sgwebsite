import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { exigerAccesCopro, simple, SANS_DONNEES } from "../../acces";
import TravailClient from "./TravailClient";

export default async function FicheTravail(props) {
  const { id } = await props.params;
  const session = await exigerAccesCopro();
  const [travail, unites, batiments, fournisseurs] = await Promise.all([
    prisma.travailCopro.findUnique({
      where: { id },
      include: {
        unite: { select: { id: true, numero: true } },
        batiment: { select: { id: true, nom: true } },
        fournisseur: { select: { id: true, nom: true, telephone: true, courriel: true } },
        demande: { select: { id: true, numero: true, titre: true, statut: true, coproprietaire: { select: { nom: true, courriel: true, avisCourriel: true } } } },
        entretien: { select: { id: true, titre: true, frequenceMois: true } },
        suivis: { orderBy: { date: "desc" } },
        fichiers: { select: SANS_DONNEES, orderBy: { creeLe: "asc" } },
      },
    }),
    prisma.uniteCopro.findMany({ select: { id: true, numero: true, batimentId: true }, orderBy: { numero: "asc" } }),
    prisma.batimentCopro.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.fournisseur.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  if (!travail) notFound();
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <TravailClient {...simple({ travail, unites, batiments, fournisseurs })} />
    </div>
  );
}
