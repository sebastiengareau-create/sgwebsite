import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import RapprochementClient from "./RapprochementClient";

export default async function Rapprochement() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  const compteBanque = await prisma.compte.findUnique({ where: { numero: "1000" } });
  const lignes = compteBanque
    ? await prisma.ligneEcriture.findMany({
        where: { compteId: compteBanque.id },
        include: { ecriture: true },
        orderBy: { ecriture: { date: "asc" } },
      })
    : [];

  const historique = await prisma.rapprochementBancaire.findMany({ orderBy: { dateRapprochement: "desc" }, take: 12 });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RapprochementClient lignes={lignes} historique={historique} />
    </div>
  );
}
