import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import { exigerAccesCopro, simple } from "../../acces";
import { vueRueDisponible } from "@/lib/photoBatimentServeur";
import { momentQuebec } from "@/lib/immobilierVisuel";
import BatimentClient from "./BatimentClient";

// Fiche d'un bâtiment de la copropriété : plan par étages (une case par
// unité, colorée selon son état), ses unités, stationnements et rangements,
// demandes et bons de travail ouverts
export default async function FicheBatiment(props) {
  const { id } = await props.params;
  const session = await exigerAccesCopro();
  const periode = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date()).slice(0, 7);
  const batiment = await prisma.batimentCopro.findUnique({
    where: { id },
    include: {
      photo: { select: { ajouteeLe: true } },
      unites: {
        include: {
          proprietes: { where: { dateFin: null }, include: { coproprietaire: { select: { id: true, nom: true, mobiliteReduite: true } } } },
          occupants: { where: { dateFin: null }, select: { type: true, nom: true, mobiliteReduite: true } },
          _count: { select: { espaces: true } },
        },
      },
      espaces: { include: { unite: { select: { id: true, numero: true } } }, orderBy: [{ type: "asc" }, { numero: "asc" }] },
      demandes: { where: { statut: { in: ["NOUVELLE", "ACCEPTEE", "EN_COURS"] } }, select: { id: true, numero: true, titre: true, statut: true, priorite: true, unite: { select: { numero: true } } }, orderBy: { creeLe: "desc" } },
      travaux: { where: { statut: { in: ["A_PLANIFIER", "PLANIFIE", "EN_COURS"] } }, select: { id: true, numero: true, titre: true, statut: true, unite: { select: { numero: true } } }, orderBy: { creeLe: "desc" } },
    },
  });
  if (!batiment) notFound();
  const ids = batiment.unites.map((u) => u.id);
  const [charges, paiements, chargesDuMois, demandes, batiments, vueRue] = await Promise.all([
    prisma.chargeCopro.groupBy({ by: ["uniteId"], where: { uniteId: { in: ids } }, _sum: { montant: true } }),
    prisma.paiementCopro.groupBy({ by: ["uniteId"], where: { uniteId: { in: ids } }, _sum: { montant: true } }),
    prisma.chargeCopro.groupBy({ by: ["uniteId"], where: { uniteId: { in: ids }, periode }, _sum: { montant: true } }),
    prisma.demandeCopro.groupBy({ by: ["uniteId"], where: { uniteId: { in: ids }, statut: { in: ["NOUVELLE", "ACCEPTEE", "EN_COURS"] } }, _count: true }),
    prisma.batimentCopro.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    vueRueDisponible(),
  ]);
  const soldes = {};
  for (const c of charges) soldes[c.uniteId] = (soldes[c.uniteId] || 0) + (c._sum.montant || 0);
  for (const p of paiements) soldes[p.uniteId] = (soldes[p.uniteId] || 0) - (p._sum.montant || 0);
  const duCeMois = Object.fromEntries(chargesDuMois.map((c) => [c.uniteId, c._sum.montant || 0]));
  const demandesDe = Object.fromEntries(demandes.map((d) => [d.uniteId, d._count]));
  batiment.espaces.sort((a, b) => a.type.localeCompare(b.type) || a.numero.localeCompare(b.numero, "fr", { numeric: true }));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <BatimentClient {...simple({ batiment, batiments, soldes, duCeMois, demandesDe, vueRue })} visuel={momentQuebec()} />
    </div>
  );
}
