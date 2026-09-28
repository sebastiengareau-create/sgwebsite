import { obtenirSession, aAccesSection, estDeveloppeur } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../components/EnTete";
import ClientsClient from "./ClientsClient";

export default async function ListeClients() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) redirect("/mecanicien");

  const [clientsBruts, facturesImpayees] = await Promise.all([
    // Le nombre de bons suffit ici — pas besoin de charger chaque bon
    prisma.client.findMany({
      include: { vehicules: true, _count: { select: { bons: true } } },
      orderBy: { nom: "asc" },
    }),
    prisma.facture.findMany({ where: { statut: "IMPAYEE" }, select: { totalAvecTaxes: true, bon: { select: { clientId: true } } } }),
  ]);
  const soldeParClient = {};
  for (const f of facturesImpayees) soldeParClient[f.bon.clientId] = (soldeParClient[f.bon.clientId] || 0) + f.totalAvecTaxes;
  const clients = clientsBruts.map((c) => ({ ...c, soldeDu: soldeParClient[c.id] || 0 }));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ClientsClient clients={clients} peutImporter={estDeveloppeur(session)} />
    </div>
  );
}
