import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerComptesTresorerie } from "@/lib/tresorerie";
import { calculerPrevisionTresorerie } from "@/lib/previsions";
import EnTete from "../../../../components/EnTete";
import PrevisionsClient from "./PrevisionsClient";

export default async function Previsions() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerComptesTresorerie();
  const prevision = await calculerPrevisionTresorerie();

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PrevisionsClient prevision={prevision} />
    </div>
  );
}
