import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CLIENT } from "@/lib/client";
import { inventairePourSoumission } from "@/lib/soumissions";
import EnTete from "../../../../../components/EnTete";
import SoumissionForm from "../../nouvelle/SoumissionForm";

export default async function ModifierSoumissionPage(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/login");

  const [soumissionExistante, clients, parametres, inventaire] = await Promise.all([
    prisma.soumission.findUnique({
      where: { id: params.id },
      include: { taches: { include: { pieces: true } }, client: { include: { vehicules: { orderBy: { creeLe: "desc" } } } } },
    }),
    prisma.client.findMany({ orderBy: { nom: "asc" }, include: { vehicules: { orderBy: { creeLe: "desc" } } } }),
    prisma.parametre.findMany(),
    // Profil rentabiliteBonEtSoumission, gérant : coûtants des pièces, pour la rentabilité de la soumission
    inventairePourSoumission({ avecCoutant: CLIENT.rentabiliteBonEtSoumission && estGerantOuDev(session) }),
  ]);
  if (!soumissionExistante) notFound();

  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);
  const tpsTaux = Number(dict.tps_taux || 5);
  const tvqTaux = Number(dict.tvq_taux || 9.975);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <SoumissionForm rentabilite={CLIENT.rentabiliteBonEtSoumission && estGerantOuDev(session)} coutHoraireMecanicien={Number(dict.cout_horaire_mecanicien || 95)} clientsExistants={clients} inventaire={inventaire} tauxHoraireClient={tauxHoraireClient} tpsTaux={tpsTaux} tvqTaux={tvqTaux} tpsNumero={dict.tps_numero || ""} tvqNumero={dict.tvq_numero || ""} soumissionExistante={soumissionExistante} vientDEtreCreee={searchParams?.creee === "1"} />
    </div>
  );
}
