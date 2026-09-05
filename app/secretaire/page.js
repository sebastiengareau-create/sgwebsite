import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../components/EnTete";
import OperationsTabs from "../components/OperationsTabs";
import FacturationPeriodes from "../components/FacturationPeriodes";
import ResumeOperations from "../components/ResumeOperations";
import ListeBonsClient from "./ListeBonsClient";

export default async function EspaceSecretaire({ searchParams }) {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await aAccesSection(session, "operations"))) redirect(`/${session.role.toLowerCase()}`);
  const filtre = searchParams?.statut;

  const bons = await prisma.bonTravail.findMany({
    where: filtre ? { statut: filtre } : undefined,
    include: { client: true, problemes: { orderBy: { id: "asc" }, include: { pieces: true } } },
    orderBy: { creeLe: "desc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <OperationsTabs />
      <FacturationPeriodes />
      <ResumeOperations />
      <ListeBonsClient bons={bons} filtreActuel={filtre} />
    </div>
  );
}
