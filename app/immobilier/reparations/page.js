import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { exigerAccesImmo, simple } from "../acces";
import ReparationsClient from "./ReparationsClient";

export default async function ReparationsImmo() {
  const session = await exigerAccesImmo();
  const [reparations, immeubles, locataires] = await Promise.all([
    prisma.reparationImmo.findMany({
      select: {
        id: true, numero: true, titre: true, statut: true, priorite: true, categorie: true, entrepreneur: true, coutEstime: true, coutReel: true, datePrevue: true, dateFin: true, creeLe: true,
        immeuble: { select: { id: true, nom: true } }, logement: { select: { id: true, numero: true, type: true } }, locataire: { select: { nom: true } },
      },
      orderBy: { creeLe: "desc" },
    }),
    prisma.immeubleImmo.findMany({ select: { id: true, nom: true, logements: { select: { id: true, numero: true, type: true }, orderBy: { numero: "asc" } } }, orderBy: { nom: "asc" } }),
    prisma.locataireImmo.findMany({ where: { baux: { some: { statut: "ACTIF" } } }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ReparationsClient {...simple({ reparations, immeubles, locataires })} />
    </div>
  );
}
