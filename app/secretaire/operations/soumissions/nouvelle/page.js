import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../../components/EnTete";
import SoumissionForm from "./SoumissionForm";

export default async function NouvelleSoumissionPage() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/login");
  const [clients, parametres] = await Promise.all([
    prisma.client.findMany({ orderBy: { nom: "asc" }, include: { vehicules: { orderBy: { creeLe: "desc" } } } }),
    prisma.parametre.findMany(),
  ]);
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);
  const tpsTaux = Number(dict.tps_taux || 5);
  const tvqTaux = Number(dict.tvq_taux || 9.975);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <SoumissionForm clientsExistants={clients} tauxHoraireClient={tauxHoraireClient} tpsTaux={tpsTaux} tvqTaux={tvqTaux} tpsNumero={dict.tps_numero || ""} tvqNumero={dict.tvq_numero || ""} />
    </div>
  );
}
