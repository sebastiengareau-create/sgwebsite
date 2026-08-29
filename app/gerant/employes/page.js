import { obtenirSession, estGerantOuDev, nomAffichageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../components/EnTete";
import EmployesClient from "./EmployesClient";

export default async function GestionEmployes() {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) redirect("/gerant");

  const employes = await prisma.user.findMany({ orderBy: { nom: "asc" } });
  const nomsRoles = {
    GERANT: await nomAffichageRole("GERANT"),
    SECRETAIRE: await nomAffichageRole("SECRETAIRE"),
    MECANICIEN: await nomAffichageRole("MECANICIEN"),
  };

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EmployesClient employes={employes} moi={session.id} nomsRoles={nomsRoles} />
    </div>
  );
}
