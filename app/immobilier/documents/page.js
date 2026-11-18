import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { exigerAccesImmo, simple, DOC_SANS_DONNEES } from "../acces";
import DocumentsClient from "./DocumentsClient";

export default async function DocumentsImmo() {
  const session = await exigerAccesImmo();
  const [documents, immeubles] = await Promise.all([
    prisma.documentImmo.findMany({
      select: { ...DOC_SANS_DONNEES, immeuble: { select: { nom: true } }, logement: { select: { id: true, numero: true, type: true } }, locataire: { select: { id: true, nom: true } } },
      orderBy: [{ date: "desc" }, { creeLe: "desc" }],
    }),
    prisma.immeubleImmo.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <DocumentsClient {...simple({ documents, immeubles })} />
    </div>
  );
}
