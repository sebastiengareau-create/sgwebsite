import { obtenirSession, aAccesSection, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { CLIENT } from "@/lib/client";
import { coutantTotal, obtenirClientInterne } from "@/lib/vehiculesAVendre";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import EnTete from "../../../../components/EnTete";
import VehiculeVenteDetailClient from "./VehiculeVenteDetailClient";
import { voisinsFiche } from "@/lib/navigationFiches";
import NavigationFiches from "../../../../components/NavigationFiches";

export default async function DetailVehiculeVente(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) redirect("/mecanicien");
  if (!CLIENT.vehiculesAVendre) redirect("/secretaire/inventaire");

  const vv = await prisma.vehiculeVente.findUnique({
    where: { id: params.id },
    include: {
      vehicule: true,
      bons: {
        include: { facture: true, problemes: { select: { description: true }, orderBy: { id: "asc" } } },
        orderBy: { creeLe: "asc" },
      },
      factureVente: { include: { client: true, compteTresorerie: true } },
    },
  });
  if (!vv) notFound();

  // Ordre par défaut de la liste : même statut (en stock / vendus), plus récents d'abord
  const ordre = await prisma.vehiculeVente.findMany({ where: { statut: vv.statut }, select: { id: true }, orderBy: { creeLe: "desc" } });
  const interne = await obtenirClientInterne();
  await assurerComptesTresorerie();
  const [clients, comptesTresorerie, parametres] = await Promise.all([
    vv.factureVente ? [] : prisma.client.findMany({
      where: { id: { not: interne.id } },
      select: { id: true, nom: true, telephone: true, numero: true },
      orderBy: { nom: "asc" },
    }),
    obtenirComptesTresoreriePourSelection(),
    prisma.parametre.findMany({ where: { cle: { in: ["tps_taux", "tvq_taux"] } } }),
  ]);
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <VehiculeVenteDetailClient
        vv={vv}
        coutant={coutantTotal(vv)}
        clients={clients}
        comptesTresorerie={comptesTresorerie}
        tpsTaux={Number(dict.tps_taux || 5)}
        tvqTaux={Number(dict.tvq_taux || 9.975)}
        peutCreerBon={await aAccesSection(session, "operations")}
        estGerant={estGerantOuDev(session)}
      />
      <NavigationFiches cle="vehicules-vente" idCourant={vv.id} base="/secretaire/inventaire/vehicules" voisinsParDefaut={voisinsFiche(ordre.map((v) => v.id), vv.id)} />
    </div>
  );
}
