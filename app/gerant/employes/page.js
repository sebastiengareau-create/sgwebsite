import { obtenirSession, aAccesSection, nomAffichageRole, estGerantOuDev, niveauRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../components/EnTete";
import EmployesClient from "./EmployesClient";

const TOUS_ROLES = ["MECANICIEN", "SECRETAIRE", "GERANT"];

export default async function GestionEmployes() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "employes"))) redirect("/gerant");

  const employes = await prisma.user.findMany({ orderBy: { nom: "asc" } });
  const nomsRoles = {
    GERANT: await nomAffichageRole("GERANT"),
    SECRETAIRE: await nomAffichageRole("SECRETAIRE"),
    MECANICIEN: await nomAffichageRole("MECANICIEN"),
  };
  // Un employé avec l'accès "employes" délégué (ex: une secrétaire) ne peut
  // créer de compte qu'à son propre niveau de sécurité ou en dessous.
  const rolesAssignables = estGerantOuDev(session) ? TOUS_ROLES : TOUS_ROLES.filter((r) => niveauRole(r) <= niveauRole(session.role));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EmployesClient employes={employes} moi={session.id} nomsRoles={nomsRoles} rolesAssignables={rolesAssignables} />
    </div>
  );
}
