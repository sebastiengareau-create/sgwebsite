import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { peutGererElevage, assurerCoupesParDefaut } from "@/lib/elevage";
import EnTete from "../../components/EnTete";
import ViandeClient from "./ViandeClient";

// ?lot=<id> : paquet scanné par son étiquette (ScanElevage) — sa vente
// s'ouvre, prise dans ce lot-là
export default async function Viande(props) {
  const lotId = (await props.searchParams)?.lot;
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererElevage(session))) redirect("/mecanicien");
  await assurerCoupesParDefaut();

  // Ventes des 12 derniers mois (le mois courant et les 11 précédents)
  const maintenant = new Date();
  const debut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 11, 1));
  const [coupes, ventes, lotScanne] = await Promise.all([
    prisma.coupeViande.findMany({
      include: {
        lots: {
          include: {
            ventes: { select: { nbPaquets: true, poids: true, date: true } },
            abattage: { select: { date: true, bete: { select: { id: true, numero: true, nom: true } } } },
          },
          orderBy: { abattage: { date: "asc" } },
        },
      },
      orderBy: [{ ordre: "asc" }, { nom: "asc" }],
    }),
    prisma.venteViande.findMany({
      where: { date: { gte: debut } },
      include: { lot: { select: { coupe: { select: { nom: true } }, abattage: { select: { bete: { select: { id: true, numero: true } } } } } } },
      orderBy: [{ date: "desc" }, { creeLe: "desc" }],
    }),
    typeof lotId === "string"
      ? prisma.lotViande.findUnique({
        where: { id: lotId },
        include: { coupe: true, ventes: { select: { nbPaquets: true, poids: true } }, abattage: { select: { date: true, bete: { select: { id: true, numero: true, nom: true } } } } },
      })
      : null,
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ViandeClient coupes={JSON.parse(JSON.stringify(coupes))} ventes={JSON.parse(JSON.stringify(ventes))}
        lotScanne={JSON.parse(JSON.stringify(lotScanne))} scanInconnu={typeof lotId === "string" && !lotScanne}
      />
    </div>
  );
}
