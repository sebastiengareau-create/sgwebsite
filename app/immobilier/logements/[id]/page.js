import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { soldesDesBaux } from "@/lib/immobilier";
import { exigerAccesImmo, simple, DOC_SANS_DONNEES } from "../../acces";
import LogementClient from "./LogementClient";

export default async function FicheLogement(props) {
  const { id } = await props.params;
  const session = await exigerAccesImmo();
  const [logement, locataires, soldes] = await Promise.all([
    prisma.logementImmo.findUnique({
      where: { id },
      include: {
        immeuble: { select: { id: true, nom: true } },
        baux: { include: { locataires: { select: { id: true, nom: true, telephone: true, courriel: true } } }, orderBy: { dateDebut: "desc" } },
        reparations: { select: { id: true, numero: true, titre: true, statut: true, priorite: true, entrepreneur: true, coutEstime: true, coutReel: true, creeLe: true }, orderBy: { creeLe: "desc" } },
        documents: { select: DOC_SANS_DONNEES, orderBy: [{ date: "desc" }, { creeLe: "desc" }] },
      },
    }),
    prisma.locataireImmo.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    soldesDesBaux({ bail: { logementId: id } }),
  ]);
  if (!logement) notFound();
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <LogementClient {...simple({ logement, locataires, soldes })} />
    </div>
  );
}
