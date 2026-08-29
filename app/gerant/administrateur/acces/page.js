import { redirect } from "next/navigation";
import { obtenirSession, DEFAUTS_INITIAUX_ROLE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import AccesEmployesClient from "./AccesEmployesClient";

const ROLES = ["GERANT", "SECRETAIRE", "MECANICIEN"];
const NOMS_STANDARD = { GERANT: "Gérant", SECRETAIRE: "Secrétaire", MECANICIEN: "Mécanicien" };

export default async function AccesEmployes() {
  const session = await obtenirSession();
  if (!session) redirect("/login");

  if (session.role !== "DEVELOPPEUR") {
    const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
    if (!utilisateur?.estSuperAdmin) redirect("/gerant");
  }

  const [employes, parametres] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["MECANICIEN", "SECRETAIRE", "GERANT"] } }, orderBy: { nom: "asc" } }),
    prisma.parametre.findMany({
      where: { cle: { in: ROLES.flatMap((r) => [`role_defaut_${r}`, `nom_role_${r}`]) } },
    }),
  ]);

  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  const defautsRoles = {
    SECRETAIRE: dict.role_defaut_SECRETAIRE !== undefined
      ? dict.role_defaut_SECRETAIRE.split(",").map((s) => s.trim()).filter(Boolean)
      : DEFAUTS_INITIAUX_ROLE.SECRETAIRE,
    MECANICIEN: dict.role_defaut_MECANICIEN !== undefined
      ? dict.role_defaut_MECANICIEN.split(",").map((s) => s.trim()).filter(Boolean)
      : DEFAUTS_INITIAUX_ROLE.MECANICIEN,
  };

  const nomsRoles = {
    GERANT: dict.nom_role_GERANT || NOMS_STANDARD.GERANT,
    SECRETAIRE: dict.nom_role_SECRETAIRE || NOMS_STANDARD.SECRETAIRE,
    MECANICIEN: dict.nom_role_MECANICIEN || NOMS_STANDARD.MECANICIEN,
  };

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <AccesEmployesClient employes={employes} defautsRolesInit={defautsRoles} nomsRolesInit={nomsRoles} />
    </div>
  );
}
