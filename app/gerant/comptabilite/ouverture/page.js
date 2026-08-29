import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import EnTete from "../../../components/EnTete";
import OuvertureClient from "./OuvertureClient";

export default async function SoldesOuverture() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  await assurerPlanComptable();
  const comptes = await prisma.compte.findMany({
    where: { actif: true, numero: { not: "3010" } }, // le compte de contrepartie ne se saisit pas lui-même
    orderBy: { numero: "asc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <OuvertureClient comptes={comptes} />
    </div>
  );
}
