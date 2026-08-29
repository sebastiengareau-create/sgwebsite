import { notFound } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../../components/EnTete";
import ClientDetailClient from "./ClientDetailClient";

export default async function DetailClientPage({ params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) redirect("/mecanicien");

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      vehicules: true,
      bons: { include: { vehicule: true, facture: true }, orderBy: { creeLe: "desc" } },
      soumissions: { orderBy: { creeLe: "desc" } },
    },
  });
  if (!client) notFound();

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ClientDetailClient client={client} />
    </div>
  );
}
