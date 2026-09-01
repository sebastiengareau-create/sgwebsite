import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import NouveauLotClient from "./NouveauLotClient";

export default async function NouveauLotPaie() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/gerant");

  const modulePaie = await prisma.parametre.findUnique({ where: { cle: "module_paie" } });
  if (modulePaie?.valeur !== "actif") redirect("/gerant");

  const employes = await prisma.user.findMany({
    where: { actif: true, role: { in: ["MECANICIEN", "SECRETAIRE", "GERANT"] } },
    orderBy: { nom: "asc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <NouveauLotClient employes={employes} />
    </div>
  );
}
