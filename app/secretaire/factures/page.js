import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import EnTete from "../../components/EnTete";
import OperationsTabs from "../../components/OperationsTabs";
import FacturationPeriodes from "../../components/FacturationPeriodes";
import ResumeOperations from "../../components/ResumeOperations";
import FacturesClient from "./FacturesClient";

export default async function ListeFactures() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/mecanicien");

  const factures = await prisma.facture.findMany({
    include: { bon: { include: { client: true } } },
    orderBy: { dateEmission: "desc" },
  });
  await assurerComptesTresorerie();
  const comptesTresorerie = await obtenirComptesTresoreriePourSelection();

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <OperationsTabs />
      <FacturationPeriodes />
      <ResumeOperations />
      <FacturesClient factures={factures} comptesTresorerie={comptesTresorerie} />
    </div>
  );
}
