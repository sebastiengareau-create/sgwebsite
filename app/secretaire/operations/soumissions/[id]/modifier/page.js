import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../../../components/EnTete";
import SoumissionForm from "../../nouvelle/SoumissionForm";

export default async function ModifierSoumissionPage({ params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/login");

  const [soumissionExistante, clients, parametres] = await Promise.all([
    prisma.soumission.findUnique({
      where: { id: params.id },
      include: { taches: { include: { pieces: true } }, client: true },
    }),
    prisma.client.findMany({ orderBy: { nom: "asc" }, include: { vehicules: true } }),
    prisma.parametre.findMany(),
  ]);
  if (!soumissionExistante) notFound();

  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <SoumissionForm clientsExistants={clients} tauxHoraireClient={tauxHoraireClient} soumissionExistante={soumissionExistante} />
    </div>
  );
}
