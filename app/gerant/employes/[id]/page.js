import { obtenirSession, aAccesSection, nomAffichageRole, estGerantOuDev, niveauRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import EnTete from "../../../components/EnTete";
import EmployeDetailClient from "./EmployeDetailClient";

const TOUS_ROLES = ["MECANICIEN", "SECRETAIRE", "GERANT"];

export default async function DetailEmploye({ params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "employes"))) redirect("/gerant");

  const [employe, paies, modulePaie] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    prisma.paie.findMany({ where: { employeId: params.id }, orderBy: { periodeFin: "desc" }, take: 10 }),
    prisma.parametre.findUnique({ where: { cle: "module_paie" } }),
  ]);
  if (!employe) notFound();

  const [accumule, dejaVerse] = await Promise.all([
    prisma.paie.aggregate({ where: { employeId: params.id, statut: { not: "CORRIGEE" }, typePaie: "REGULIERE" }, _sum: { vacancesAccumulees: true } }),
    prisma.paie.aggregate({ where: { employeId: params.id, statut: { not: "CORRIGEE" }, typePaie: "VACANCES" }, _sum: { salaireBrut: true } }),
  ]);
  const soldeVacances = Math.max(0, (accumule._sum.vacancesAccumulees || 0) - (dejaVerse._sum.salaireBrut || 0));
  const nomsRoles = {
    GERANT: await nomAffichageRole("GERANT"),
    SECRETAIRE: await nomAffichageRole("SECRETAIRE"),
    MECANICIEN: await nomAffichageRole("MECANICIEN"),
  };
  // Même règle que la création : un employé avec l'accès "employes" délégué
  // ne peut ni assigner un rôle au-dessus du sien, ni toucher au rôle de
  // quelqu'un dont le niveau actuel dépasse déjà le sien.
  const rolesAssignables = estGerantOuDev(session) ? TOUS_ROLES : TOUS_ROLES.filter((r) => niveauRole(r) <= niveauRole(session.role));
  const peutModifierRole = estGerantOuDev(session) || niveauRole(employe.role) <= niveauRole(session.role);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EmployeDetailClient
        employe={employe} paies={paies} estMoi={employe.id === session.id} paieActif={modulePaie?.valeur === "actif"}
        soldeVacances={soldeVacances} nomsRoles={nomsRoles} peutModifierTheme={estGerantOuDev(session)}
        rolesAssignables={rolesAssignables} peutModifierRole={peutModifierRole}
      />
    </div>
  );
}
