import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../../components/EnTete";
import RendezVousForm from "./RendezVousForm";

export default async function NouveauRendezVousPage() {
  const session = await obtenirSession();

  const parametreCalendrier = await prisma.parametre.findUnique({ where: { cle: "module_calendrier" } });
  if (parametreCalendrier?.valeur === "inactif") redirect("/secretaire");

  const clients = await prisma.client.findMany({ orderBy: { nom: "asc" } });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RendezVousForm clientsExistants={clients} />
    </div>
  );
}
