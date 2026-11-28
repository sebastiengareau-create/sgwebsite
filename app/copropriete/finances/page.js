import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { lienComptaCoproActif } from "@/lib/coproprieteCompta";
import { exigerAccesCopro, simple } from "../acces";
import FinancesClient from "./FinancesClient";

export default async function FinancesCopro(props) {
  const searchParams = await props.searchParams;
  const session = await exigerAccesCopro();
  const depuis = new Date();
  depuis.setMonth(depuis.getMonth() - 24);
  const [budgets, unites, sommeCharges, sommePaiements, cotisations, derniersPaiements, batiments] = await Promise.all([
    prisma.budgetCopro.findMany({ orderBy: { annee: "desc" } }),
    prisma.uniteCopro.findMany({ select: { id: true, numero: true, quotePart: true, batimentId: true, batiment: { select: { nom: true } }, proprietes: { where: { dateFin: null }, select: { coproprietaire: { select: { nom: true } } } } } }),
    prisma.chargeCopro.groupBy({ by: ["uniteId"], _sum: { montant: true } }),
    prisma.paiementCopro.groupBy({ by: ["uniteId"], _sum: { montant: true } }),
    prisma.chargeCopro.groupBy({ by: ["periode", "type"], where: { periode: { not: null }, date: { gte: depuis } }, _sum: { montant: true }, _count: true }),
    prisma.paiementCopro.findMany({ include: { unite: { select: { numero: true } } }, orderBy: [{ date: "desc" }, { creeLe: "desc" }], take: 30 }),
    prisma.batimentCopro.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  unites.sort((a, b) => (a.batiment?.nom || "").localeCompare(b.batiment?.nom || "", "fr") || a.numero.localeCompare(b.numero, "fr", { numeric: true }));
  const compta = await lienComptaCoproActif();
  const soldes = {};
  for (const c of sommeCharges) soldes[c.uniteId] = (soldes[c.uniteId] || 0) + (c._sum.montant || 0);
  for (const p of sommePaiements) soldes[p.uniteId] = (soldes[p.uniteId] || 0) - (p._sum.montant || 0);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <FinancesClient {...simple({ budgets, unites, soldes, cotisations, derniersPaiements, batiments })} ongletInitial={searchParams?.onglet} compta={compta} />
    </div>
  );
}
