import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculerRapportVentes, analyserFiltresPeriode } from "@/lib/rapportVentes";
import EnTete from "../../../components/EnTete";
import OperationsTabs from "../../../components/OperationsTabs";
import RapportVentesClient from "./RapportVentesClient";

export default async function RapportVentes({ searchParams }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/mecanicien");

  const { debutStr, finStr, groupement, debut, fin } = analyserFiltresPeriode(searchParams || {});

  const [factures, nombreAnnulees] = await Promise.all([
    prisma.facture.findMany({
      where: { dateEmission: { gte: debut, lte: fin }, statut: { not: "ANNULEE" } },
      orderBy: { dateEmission: "asc" },
    }),
    prisma.facture.count({ where: { dateEmission: { gte: debut, lte: fin }, statut: "ANNULEE" } }),
  ]);

  const { lignes, totaux, ticketMoyen } = calculerRapportVentes(factures, groupement);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <OperationsTabs />
      <RapportVentesClient
        lignes={lignes}
        totaux={totaux}
        ticketMoyen={ticketMoyen}
        debutStr={debutStr}
        finStr={finStr}
        groupement={groupement}
        nombreAnnulees={nombreAnnulees}
      />
    </div>
  );
}
