import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { exigerAccesCopro, simple, SANS_DONNEES } from "../../acces";
import DemandeClient from "./DemandeClient";

export default async function FicheDemande(props) {
  const { id } = await props.params;
  const session = await exigerAccesCopro();
  const [demande, unites, batiments, coproprietaires, fournisseurs] = await Promise.all([
    prisma.demandeCopro.findUnique({
      where: { id },
      include: {
        unite: { select: { id: true, numero: true } },
        batiment: { select: { id: true, nom: true } },
        coproprietaire: { select: { id: true, nom: true, courriel: true, telephone: true, avisCourriel: true } },
        fichiers: { select: SANS_DONNEES, orderBy: { creeLe: "asc" } },
        travaux: { select: { id: true, numero: true, titre: true, statut: true, coutReel: true, coutEstime: true, fournisseur: { select: { nom: true } } }, orderBy: { creeLe: "asc" } },
      },
    }),
    prisma.uniteCopro.findMany({ select: { id: true, numero: true, batimentId: true }, orderBy: { numero: "asc" } }),
    prisma.batimentCopro.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.coproprietaireCopro.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.fournisseur.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  if (!demande) notFound();
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <DemandeClient {...simple({ demande, unites, batiments, coproprietaires, fournisseurs })} />
    </div>
  );
}
