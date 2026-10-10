import { notFound } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../../components/EnTete";
import ClientDetailClient from "./ClientDetailClient";
import { voisinsFiche } from "@/lib/navigationFiches";
import NavigationFiches from "../../../components/NavigationFiches";

export default async function DetailClientPage(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) redirect("/mecanicien");

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      bons: { include: { facture: true, vehicule: true }, orderBy: { creeLe: "desc" } },
      soumissions: { orderBy: { creeLe: "desc" } },
      vehicules: { include: { _count: { select: { bons: true } } }, orderBy: { creeLe: "desc" } },
    },
  });
  if (!client) notFound();
  const ordre = await prisma.client.findMany({ select: { id: true }, orderBy: { nom: "asc" } });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ClientDetailClient client={client} />
      <NavigationFiches cle="clients" idCourant={client.id} base="/secretaire/clients" voisinsParDefaut={voisinsFiche(ordre.map((c) => c.id), client.id)} />
    </div>
  );
}
