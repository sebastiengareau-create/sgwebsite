import { obtenirSession, aAccesSection, estDeveloppeur } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../components/EnTete";
import ClientsClient from "./ClientsClient";

export default async function ListeClients() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) redirect("/mecanicien");

  const clients = await prisma.client.findMany({
    include: { bons: true, vehicules: true },
    orderBy: { nom: "asc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ClientsClient clients={clients} peutImporter={estDeveloppeur(session)} />
    </div>
  );
}
