import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { comptesDesBaux } from "@/lib/immobilier";
import { exigerAccesImmo, simple } from "../acces";
import { vueRueDisponible } from "@/lib/photoBatimentServeur";
import ImmeublesClient from "./ImmeublesClient";

export default async function ImmeublesImmo() {
  const session = await exigerAccesImmo();
  const [immeubles, comptes, reparations, vueRue] = await Promise.all([
    prisma.immeubleImmo.findMany({
      include: { photo: { select: { ajouteeLe: true } }, logements: { select: { id: true, loyerVise: true, baux: { where: { statut: "ACTIF" }, select: { id: true, loyer: true, statut: true, dateDebut: true } } } } },
      orderBy: { nom: "asc" },
    }),
    comptesDesBaux(),
    prisma.reparationImmo.groupBy({ by: ["immeubleId"], where: { statut: { in: ["NOUVELLE", "PLANIFIEE", "EN_COURS"] } }, _count: true }),
    vueRueDisponible(),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ImmeublesClient {...simple({ immeubles, comptes, reparations: Object.fromEntries(reparations.map((r) => [r.immeubleId, r._count])), vueRue })} />
    </div>
  );
}
