import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { peutGererElevage, lireRendementCarcasse, lireGmqCible } from "@/lib/elevage";
import EnTete from "../components/EnTete";
import TroupeauClient from "./TroupeauClient";

export default async function Troupeau() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererElevage(session))) redirect("/mecanicien");

  const [betes, rendementCarcasse, gmqCible] = await Promise.all([
    prisma.bete.findMany({
      include: {
        pesees: { select: { date: true, poids: true } },
        frais: { select: { montant: true } },
        soins: { select: { id: true, date: true, type: true, produit: true, retraitJours: true, rappelLe: true } },
        mere: { select: { numero: true, nom: true } },
        deplacements: { select: { date: true, creeLe: true, type: true, lieu: true, site: true } },
        saillies: { where: { statut: { in: ["EN_ATTENTE", "GESTANTE"] } }, select: { id: true, date: true, statut: true } },
        abattage: { select: { date: true, poidsCarcasse: true, bms: true, fraisAbattage: true, lots: { select: { ventes: { select: { montant: true } } } } } },
      },
      orderBy: { numero: "asc" },
    }),
    lireRendementCarcasse(),
    lireGmqCible(),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <TroupeauClient betes={JSON.parse(JSON.stringify(betes))} rendementCarcasse={rendementCarcasse} gmqCible={gmqCible} />
    </div>
  );
}
