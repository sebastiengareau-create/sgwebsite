import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import PaieClient from "./PaieClient";

export default async function Paie() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/gerant");

  const modulePaie = await prisma.parametre.findUnique({ where: { cle: "module_paie" } });
  if (modulePaie?.valeur !== "actif") redirect("/gerant");

  const [employes, paiesRecentes] = await Promise.all([
    prisma.user.findMany({ where: { actif: true, role: { in: ["MECANICIEN", "SECRETAIRE", "GERANT"] } }, orderBy: { nom: "asc" } }),
    prisma.paie.findMany({ include: { employe: true }, orderBy: { periodeFin: "desc" }, take: 30 }),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PaieClient employes={employes} paiesRecentes={paiesRecentes} />
    </div>
  );
}
