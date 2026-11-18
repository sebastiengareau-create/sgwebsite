import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { exigerAccesImmo, simple, DOC_SANS_DONNEES } from "../../acces";
import BailClient from "./BailClient";

export default async function FicheBail(props) {
  const { id } = await props.params;
  const session = await exigerAccesImmo();
  const [bail, locataires] = await Promise.all([
    prisma.bailImmo.findUnique({
      where: { id },
      include: {
        logement: { select: { id: true, numero: true, type: true, pieces: true, immeuble: { select: { id: true, nom: true, adresse: true, ville: true } } } },
        locataires: { select: { id: true, nom: true, telephone: true, courriel: true } },
        charges: { orderBy: { date: "asc" } },
        paiements: { orderBy: { date: "asc" } },
        documents: { select: DOC_SANS_DONNEES, orderBy: [{ date: "desc" }, { creeLe: "desc" }] },
      },
    }),
    prisma.locataireImmo.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  if (!bail) notFound();
  // Bail qui suit ou précède celui-ci dans le même logement
  const [suivant, precedent] = await Promise.all([
    prisma.bailImmo.findFirst({ where: { logementId: bail.logementId, dateDebut: { gt: bail.dateDebut } }, orderBy: { dateDebut: "asc" }, select: { id: true, dateDebut: true, loyer: true } }),
    prisma.bailImmo.findFirst({ where: { logementId: bail.logementId, dateDebut: { lt: bail.dateDebut } }, orderBy: { dateDebut: "desc" }, select: { id: true, dateDebut: true, loyer: true } }),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <BailClient {...simple({ bail, locataires, suivant, precedent })} />
    </div>
  );
}
