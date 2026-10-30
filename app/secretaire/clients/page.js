import { obtenirSession, aAccesSection, estDeveloppeur } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../components/EnTete";
import ClientsClient from "./ClientsClient";

export default async function ListeClients() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) redirect("/mecanicien");

  const [clientsBruts, facturesImpayees] = await Promise.all([
    // Seulement ce que la liste affiche ou fouille (ClientsClient) — le
    // nombre de bons suffit, pas besoin de charger chaque bon
    prisma.client.findMany({
      select: {
        id: true, numero: true, nom: true, telephone: true, courriel: true, adresse: true, ville: true, province: true, codePostal: true, garantieProlongee: true,
        vehicules: { select: { annee: true, marque: true, modele: true, version: true, niv: true, plaque: true } },
        _count: { select: { bons: true } },
      },
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
