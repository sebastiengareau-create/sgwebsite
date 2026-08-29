import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../../components/EnTete";
import SoumissionForm from "./SoumissionForm";

export default async function NouvelleSoumissionPage() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/login");
  const [clients, parametres] = await Promise.all([
    prisma.client.findMany({ orderBy: { nom: "asc" }, include: { vehicules: true } }),
    prisma.parametre.findMany(),
  ]);
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <SoumissionForm clientsExistants={clients} tauxHoraireClient={tauxHoraireClient} />
    </div>
  );
}
