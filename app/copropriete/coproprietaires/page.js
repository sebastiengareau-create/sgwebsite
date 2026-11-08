import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { exigerAccesCopro, simple } from "../acces";
import CoproprietairesClient from "./CoproprietairesClient";

export default async function CoproprietairesCopro() {
  const session = await exigerAccesCopro();
  const coproprietaires = await prisma.coproprietaireCopro.findMany({
    select: {
      id: true, nom: true, courriel: true, telephone: true, jetonPortail: true,
      proprietes: { where: { dateFin: null }, select: { partDetenue: true, unite: { select: { id: true, numero: true, quotePart: true } } } },
    },
    orderBy: { nom: "asc" },
  });
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <CoproprietairesClient coproprietaires={simple(coproprietaires.map(({ jetonPortail, ...c }) => ({ ...c, portail: Boolean(jetonPortail) })))} />
    </div>
  );
}
