import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CLIENT } from "@/lib/client";
import { coutantTotal, assurerComptesVehiculesAVendre } from "@/lib/vehiculesAVendre";
import EnTete from "../../../components/EnTete";
import VehiculesVenteClient from "./VehiculesVenteClient";

export default async function VehiculesAVendre() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) redirect("/mecanicien");
  if (!CLIENT.vehiculesAVendre) redirect("/secretaire/inventaire");
  // Comptes et poste « Achat de véhicule à vendre » prêts avant la saisie
  // de la facture d'achat dans les comptes à payer
  await assurerComptesVehiculesAVendre();

  const liste = await prisma.vehiculeVente.findMany({
    include: {
      vehicule: true,
      bons: { select: { facture: { select: { totalFacture: true, statut: true } } } },
      factureVente: { select: { numero: true, prixVente: true, coutantVehicule: true, dateEmission: true, statut: true, client: { select: { nom: true } } } },
    },
    orderBy: { creeLe: "desc" },
  });
  const vehicules = liste.map((vv) => ({
    id: vv.id, numero: vv.numero, statut: vv.statut, vehicule: vv.vehicule,
    prixDemande: vv.prixDemande, coutant: coutantTotal(vv),
    bonsOuverts: vv.bons.filter((b) => !b.facture).length,
    vente: vv.factureVente,
  }));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <VehiculesVenteClient vehicules={vehicules} />
    </div>
  );
}
