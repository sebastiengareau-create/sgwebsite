import { prisma } from "@/lib/prisma";
import EnTete from "../components/EnTete";
import { exigerAccesCopro, simple } from "./acces";
import TableauBordClient from "./TableauBordClient";

export default async function TableauBordCopro() {
  const session = await exigerAccesCopro();
  const [unites, nbCoproprietaires, demandes, travaux, entretiens, budgets, documents, sommeCharges, sommePaiements] = await Promise.all([
    prisma.uniteCopro.findMany({ select: { id: true, numero: true, type: true, quotePart: true, proprietes: { where: { dateFin: null }, select: { id: true } } } }),
    prisma.coproprietaireCopro.count(),
    prisma.demandeCopro.findMany({
      where: { statut: { in: ["NOUVELLE", "ACCEPTEE", "EN_COURS"] } },
      select: { id: true, numero: true, titre: true, priorite: true, statut: true, creeLe: true, source: true, unite: { select: { numero: true } }, emplacement: true },
      orderBy: { creeLe: "desc" },
    }),
    prisma.travailCopro.findMany({
      where: { statut: { in: ["A_PLANIFIER", "PLANIFIE", "EN_COURS"] } },
      select: { id: true, numero: true, titre: true, priorite: true, statut: true, datePrevue: true, coutEstime: true, fournisseur: { select: { nom: true } } },
      orderBy: [{ datePrevue: "asc" }, { creeLe: "asc" }],
    }),
    prisma.entretienCopro.findMany({ where: { actif: true }, select: { id: true, titre: true, type: true, prochaineDate: true, obligatoire: true }, orderBy: { prochaineDate: "asc" } }),
    prisma.budgetCopro.findMany({ orderBy: { annee: "desc" } }),
    prisma.documentCopro.findMany({ select: { id: true, titre: true, categorie: true, date: true, creeLe: true }, orderBy: { creeLe: "desc" }, take: 5 }),
    prisma.chargeCopro.groupBy({ by: ["uniteId"], _sum: { montant: true } }),
    prisma.paiementCopro.groupBy({ by: ["uniteId"], _sum: { montant: true } }),
  ]);
  const paye = Object.fromEntries(sommePaiements.map((p) => [p.uniteId, p._sum.montant || 0]));
  const soldes = sommeCharges.map((c) => ({ uniteId: c.uniteId, solde: Math.round(((c._sum.montant || 0) - (paye[c.uniteId] || 0)) * 100) / 100 }));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <TableauBordClient {...simple({ unites, nbCoproprietaires, demandes, travaux, entretiens, budgets, documents, soldes })} />
    </div>
  );
}
