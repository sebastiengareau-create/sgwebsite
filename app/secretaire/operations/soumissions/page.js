import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import OperationsTabs from "../../../components/OperationsTabs";
import ResumeOperations from "../../../components/ResumeOperations";
import SoumissionsListe from "./SoumissionsListe";

export default async function ListeSoumissions() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/login");
  const [soumissions, parametres] = await Promise.all([
    prisma.soumission.findMany({
      include: { taches: { include: { pieces: true } } },
      orderBy: { creeLe: "desc" },
    }),
    prisma.parametre.findMany(),
  ]);
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <OperationsTabs />
      <ResumeOperations />
      <SoumissionsListe soumissions={soumissions} tauxHoraireClient={tauxHoraireClient} />
    </div>
  );
}
