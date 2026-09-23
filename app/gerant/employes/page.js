import { obtenirSession, aAccesSection, nomAffichageRole, estNiveauMaxOuDev, niveauRole, ROLES_VALIDES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../components/EnTete";
import EmployesClient from "./EmployesClient";

export default async function GestionEmployes() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "employes"))) redirect("/gerant");

  const employes = await prisma.user.findMany({ orderBy: { nom: "asc" } });
  const nomsRoles = Object.fromEntries(await Promise.all(ROLES_VALIDES.map(async (r) => [r, await nomAffichageRole(r)])));
  // Un employé (même un GERANT) ne peut créer de compte qu'à son propre
  // niveau de sécurité ou en dessous — seul le niveau 4/développeur voit
  // tous les rôles.
  const rolesAssignables = estNiveauMaxOuDev(session) ? ROLES_VALIDES : ROLES_VALIDES.filter((r) => niveauRole(r) <= niveauRole(session.role));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EmployesClient employes={employes} moi={session.id} nomsRoles={nomsRoles} rolesAssignables={rolesAssignables} />
    </div>
  );
}
