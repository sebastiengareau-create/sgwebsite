import { notFound } from "next/navigation";
import { obtenirSession, aAccesSection, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../../components/EnTete";
import ClientDetailClient from "./ClientDetailClient";
import { peutGererDestinataire } from "@/lib/documentsServeur";
import { voisinsFiche } from "@/lib/navigationFiches";
import NavigationFiches from "../../../components/NavigationFiches";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import { portailActif, lienPortailClient } from "@/lib/portailClient";
import { obtenirInfosEntreprise } from "@/lib/config";
import { courrielConfigure } from "@/lib/courrielDocuments";

export default async function DetailClientPage(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) redirect("/mecanicien");

  const [client, ordre, peutModifierCredit, peutRedigerLettre] = await Promise.all([prisma.client.findUnique({
    where: { id: params.id },
    include: {
      bons: { include: { facture: true, vehicule: true }, orderBy: { creeLe: "desc" } },
      soumissions: { orderBy: { creeLe: "desc" } },
      vehicules: { include: { _count: { select: { bons: true } } }, orderBy: { creeLe: "desc" } },
      // Crédit client (lib/creditClient.js) : historique, le plus récent en haut
      credits: {
        include: {
          compteTresorerie: { select: { nom: true } },
          facture: { select: { numero: true, bonId: true } },
          paiementFacture: { select: { facture: { select: { numero: true, bonId: true } } } },
        },
        orderBy: { date: "desc" },
      },
    },
  }),
  prisma.client.findMany({ select: { id: true }, orderBy: { nom: "asc" } }),
  aAccesSection(session, "operations"),
  peutGererDestinataire(session, "CLIENT"),
  ]);
  if (!client) notFound();
  if (peutModifierCredit && client.credits.length > 0) await assurerComptesTresorerie();
  const comptesTresorerie = peutModifierCredit && client.credits.length > 0 ? await obtenirComptesTresoreriePourSelection() : [];
  // Portail client (lib/portailClient.js) : le lien du client, s'il en a un
  const portail = (await portailActif())
    ? {
      lien: client.jetonPortail ? lienPortailClient(client.jetonPortail) : null, creeLe: client.portailCreeLe, vuLe: client.portailVuLe,
      courrielPret: courrielConfigure(), nomEntreprise: (await obtenirInfosEntreprise()).nomEntreprise,
    }
    : null;

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ClientDetailClient
        client={client} peutRedigerLettre={peutRedigerLettre}
        comptesTresorerie={comptesTresorerie} peutModifierCredit={peutModifierCredit} peutAccorderGeste={estGerantOuDev(session)}
        portail={portail}
      />
      <NavigationFiches cle="clients" idCourant={client.id} base="/secretaire/clients" voisinsParDefaut={voisinsFiche(ordre.map((c) => c.id), client.id)} />
    </div>
  );
}
