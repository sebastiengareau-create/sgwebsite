import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { exigerAccesCopro, simple } from "../acces";
import DocumentsClient from "./DocumentsClient";

export default async function DocumentsCopro() {
  const session = await exigerAccesCopro();
  const [documents, unites, batiments] = await Promise.all([
    prisma.documentCopro.findMany({
      select: { id: true, titre: true, categorie: true, date: true, description: true, visibilite: true, uniteId: true, batimentId: true, nom: true, typeMime: true, taille: true, creePar: true, creeLe: true, unite: { select: { numero: true } }, batiment: { select: { nom: true } } },
      orderBy: [{ date: { sort: "desc", nulls: "last" } }, { creeLe: "desc" }],
    }),
    prisma.uniteCopro.findMany({ select: { id: true, numero: true } }),
    prisma.batimentCopro.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  unites.sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <DocumentsClient {...simple({ documents, unites, batiments })} />
    </div>
  );
}
