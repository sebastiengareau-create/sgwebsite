import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerComptesTresorerie, obtenirComptesTresorerieAvecSoldes } from "@/lib/tresorerie";
import EnTete from "../../../../components/EnTete";
import ComptesClient from "./ComptesClient";

export default async function ComptesTresorerie() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerComptesTresorerie();
  const comptes = await obtenirComptesTresorerieAvecSoldes({ actifSeulement: false });

  const comptesGlDisponibles = await prisma.compte.findMany({
    where: { actif: true, type: { in: ["ACTIF", "PASSIF"] }, compteTresorerie: null },
    orderBy: { numero: "asc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ComptesClient comptes={comptes} comptesGlDisponibles={comptesGlDisponibles} />
    </div>
  );
}
