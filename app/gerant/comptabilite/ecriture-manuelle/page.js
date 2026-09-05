import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import EnTete from "../../../components/EnTete";
import EcritureManuelleClient from "./EcritureManuelleClient";

export default async function EcritureManuelle() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerPlanComptable();
  const comptes = await prisma.compte.findMany({ where: { actif: true }, orderBy: { numero: "asc" } });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EcritureManuelleClient comptes={comptes} />
    </div>
  );
}
