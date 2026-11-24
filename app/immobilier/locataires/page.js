import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { comptesDesBaux } from "@/lib/immobilier";
import { exigerAccesImmo, simple } from "../acces";
import LocatairesClient from "./LocatairesClient";

export default async function LocatairesImmo() {
  const session = await exigerAccesImmo();
  const [locataires, comptes] = await Promise.all([
    prisma.locataireImmo.findMany({
      include: { baux: { select: { id: true, statut: true, loyer: true, dateFin: true, logement: { select: { id: true, numero: true, type: true, immeuble: { select: { nom: true } } } } }, orderBy: { dateDebut: "desc" } } },
      orderBy: { nom: "asc" },
    }),
    comptesDesBaux(),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <LocatairesClient {...simple({ locataires, comptes })} />
    </div>
  );
}
