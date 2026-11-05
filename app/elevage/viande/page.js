import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { peutGererElevage, assurerCoupesParDefaut } from "@/lib/elevage";
import EnTete from "../../components/EnTete";
import ViandeClient from "./ViandeClient";

export default async function Viande() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererElevage(session))) redirect("/mecanicien");
  await assurerCoupesParDefaut();

  const debutAnnee = new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`);
  const [coupes, ventes] = await Promise.all([
    prisma.coupeViande.findMany({
      include: {
        lots: {
          include: {
            ventes: { select: { nbPaquets: true, poids: true } },
            abattage: { select: { date: true, bete: { select: { id: true, numero: true, nom: true } } } },
          },
          orderBy: { abattage: { date: "asc" } },
        },
      },
      orderBy: [{ ordre: "asc" }, { nom: "asc" }],
    }),
    prisma.venteViande.findMany({
      where: { date: { gte: debutAnnee } },
      include: { lot: { select: { coupe: { select: { nom: true } }, abattage: { select: { bete: { select: { id: true, numero: true } } } } } } },
      orderBy: [{ date: "desc" }, { creeLe: "desc" }],
    }),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ViandeClient coupes={JSON.parse(JSON.stringify(coupes))} ventes={JSON.parse(JSON.stringify(ventes))} />
    </div>
  );
}
