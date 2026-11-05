import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { peutGererElevage, lireRendementCarcasse } from "@/lib/elevage";
import EnTete from "../components/EnTete";
import TroupeauClient from "./TroupeauClient";

export default async function Troupeau() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererElevage(session))) redirect("/mecanicien");

  const [betes, rendementCarcasse] = await Promise.all([
    prisma.bete.findMany({
      include: {
        pesees: { select: { date: true, poids: true } },
        frais: { select: { montant: true } },
        mere: { select: { numero: true, nom: true } },
        abattage: { select: { date: true, poidsCarcasse: true, bms: true, fraisAbattage: true, lots: { select: { ventes: { select: { montant: true } } } } } },
      },
      orderBy: { numero: "asc" },
    }),
    lireRendementCarcasse(),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <TroupeauClient betes={JSON.parse(JSON.stringify(betes))} rendementCarcasse={rendementCarcasse} />
    </div>
  );
}
