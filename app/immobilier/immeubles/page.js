import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { comptesDesBaux } from "@/lib/immobilier";
import { exigerAccesImmo, simple } from "../acces";
import { vueRueDisponible } from "@/lib/photoBatimentServeur";
import { momentQuebec } from "@/lib/immobilierVisuel";
import ImmeublesClient from "./ImmeublesClient";

export default async function ImmeublesImmo() {
  const session = await exigerAccesImmo();
  const [immeubles, comptes, reparations, vueRue] = await Promise.all([
    prisma.immeubleImmo.findMany({
      include: {
        photo: { select: { ajouteeLe: true } },
        logements: {
          select: {
            id: true, numero: true, type: true, etage: true, loyerVise: true,
            baux: { where: { statut: "ACTIF" }, select: { id: true, loyer: true, statut: true, dateDebut: true, dateFin: true, avisEnvoyeLe: true, reponseAvis: true, locataires: { select: { nom: true } } } },
          },
        },
      },
      orderBy: { nom: "asc" },
    }),
    comptesDesBaux(),
    prisma.reparationImmo.groupBy({ by: ["immeubleId"], where: { statut: { in: ["NOUVELLE", "PLANIFIEE", "EN_COURS"] } }, _count: true }),
    vueRueDisponible(),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ImmeublesClient {...simple({ immeubles, comptes, reparations: Object.fromEntries(reparations.map((r) => [r.immeubleId, r._count])), vueRue, visuel: momentQuebec() })} />
    </div>
  );
}
