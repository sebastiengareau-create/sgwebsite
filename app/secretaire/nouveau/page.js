import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import NouveauBonForm from "./NouveauBonForm";

export default async function NouveauBonPage() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/login");
  const [clients, moduleCalendrier] = await Promise.all([
    prisma.client.findMany({
      include: { vehicules: { orderBy: { creeLe: "desc" } } },
      orderBy: { nom: "asc" },
    }),
    prisma.parametre.findUnique({ where: { cle: "module_calendrier" } }),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <NouveauBonForm clientsExistants={clients} calendrierActif={moduleCalendrier?.valeur !== "inactif"} />
    </div>
  );
}
