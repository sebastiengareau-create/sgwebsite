import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { exigerAccesCopro, simple } from "../acces";
import UnitesClient from "./UnitesClient";

export default async function UnitesCopro() {
  const session = await exigerAccesCopro();
  const [unites, batiments, espaces, charges, paiements] = await Promise.all([
    prisma.uniteCopro.findMany({
      include: {
        batiment: { select: { nom: true } },
        proprietes: { where: { dateFin: null }, include: { coproprietaire: { select: { id: true, nom: true } } } },
        occupants: { where: { dateFin: null }, select: { type: true, nom: true } },
        _count: { select: { espaces: true } },
      },
    }),
    prisma.batimentCopro.findMany({ include: { _count: { select: { unites: true } } }, orderBy: { nom: "asc" } }),
    prisma.espaceCopro.findMany({ include: { unite: { select: { id: true, numero: true } }, batiment: { select: { nom: true } } }, orderBy: [{ type: "asc" }, { numero: "asc" }] }),
    prisma.chargeCopro.groupBy({ by: ["uniteId"], _sum: { montant: true } }),
    prisma.paiementCopro.groupBy({ by: ["uniteId"], _sum: { montant: true } }),
  ]);
  const soldes = {};
  for (const c of charges) soldes[c.uniteId] = (soldes[c.uniteId] || 0) + (c._sum.montant || 0);
  for (const p of paiements) soldes[p.uniteId] = (soldes[p.uniteId] || 0) - (p._sum.montant || 0);
  // Tri naturel : 101, 102, 201… avant 1001
  unites.sort((a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true }));
  espaces.sort((a, b) => a.type.localeCompare(b.type) || a.numero.localeCompare(b.numero, "fr", { numeric: true }));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <UnitesClient {...simple({ unites, batiments, espaces, soldes })} />
    </div>
  );
}
