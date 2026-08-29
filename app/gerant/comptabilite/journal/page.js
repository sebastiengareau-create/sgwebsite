import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import JournalClient from "./JournalClient";

export default async function Journal() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const ecritures = await prisma.ecritureComptable.findMany({
    include: { lignes: { include: { compte: true } } },
    orderBy: { date: "desc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <JournalClient ecritures={ecritures} />
    </div>
  );
}
