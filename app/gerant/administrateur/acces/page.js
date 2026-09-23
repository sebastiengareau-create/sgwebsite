import { redirect } from "next/navigation";
import { obtenirSession, DEFAUTS_INITIAUX_ROLE, ROLES_VALIDES, nomAffichageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import AccesEmployesClient from "./AccesEmployesClient";

// NIVEAU4 (accès total, non configurable — voir AccesEmployesClient) n'a pas
// de défauts de sections à charger, contrairement aux autres rôles.
const ROLES_CONFIGURABLES = ["GERANT", "SECRETAIRE", "MECANICIEN"];

export default async function AccesEmployes() {
  const session = await obtenirSession();
  if (!session) redirect("/login");

  if (session.role !== "DEVELOPPEUR") {
    const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
    if (!utilisateur?.estSuperAdmin) redirect("/gerant");
  }

  const [employes, parametres, nomsRoles] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ROLES_VALIDES } }, orderBy: { nom: "asc" } }),
    prisma.parametre.findMany({
      where: { cle: { in: ROLES_CONFIGURABLES.map((r) => `role_defaut_${r}`) } },
    }),
    Promise.all(ROLES_VALIDES.map(async (r) => [r, await nomAffichageRole(r)])).then(Object.fromEntries),
  ]);

  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  const defautsRoles = Object.fromEntries(ROLES_CONFIGURABLES.map((r) => [
    r,
    dict[`role_defaut_${r}`] !== undefined
      ? dict[`role_defaut_${r}`].split(",").map((s) => s.trim()).filter(Boolean)
      : (DEFAUTS_INITIAUX_ROLE[r] || []),
  ]));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <AccesEmployesClient employes={employes} defautsRolesInit={defautsRoles} nomsRolesInit={nomsRoles} />
    </div>
  );
}
