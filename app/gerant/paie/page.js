import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import PaieClient from "./PaieClient";

export default async function Paie() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/gerant");

  const modulePaie = await prisma.parametre.findUnique({ where: { cle: "module_paie" } });
  if (modulePaie?.valeur !== "actif") redirect("/gerant");

  const lots = await prisma.lotPaie.findMany({
    include: { paies: true },
    orderBy: { creeLe: "desc" },
    take: 30,
  });

  const lotsAvecTotaux = lots.map((lot) => ({
    id: lot.id,
    numero: lot.numero,
    periodeDebut: lot.periodeDebut,
    periodeFin: lot.periodeFin,
    typePaie: lot.typePaie,
    statut: lot.statut,
    comptabiliseLe: lot.comptabiliseLe,
    nbEmployes: lot.paies.length,
    totalBrut: lot.paies.reduce((s, p) => s + p.salaireBrut, 0),
    totalDeductions: lot.paies.reduce((s, p) => s + p.totalDeductions, 0),
    totalNet: lot.paies.reduce((s, p) => s + p.salaireNet, 0),
  }));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PaieClient lots={lotsAvecTotaux} />
    </div>
  );
}
