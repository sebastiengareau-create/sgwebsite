import { notFound, redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bonEstVerrouille } from "@/lib/bons";
import { lireParametres } from "@/lib/parametres";
import { obtenirInfosEntreprise } from "@/lib/config";
import { inspectionActive, lienInspection, lireSeuils } from "@/lib/inspections";
import { historiquePoints } from "@/lib/rappelsInspection";
import EnTete from "../../../../components/EnTete";
import InspectionClient from "./InspectionClient";

// Inspection numérique d'un véhicule (lib/inspections.js) : le technicien
// vérifie chaque point ; le comptoir met les prix, envoie le rapport au
// client et ajoute au bon les travaux approuvés.
export default async function PageInspection(props) {
  const { id: bonId, inspectionId } = await props.params;
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await inspectionActive())) redirect(`/bons/${bonId}`);

  const [inspection, verrouille, comptoir, dict, { nomEntreprise }, seuils] = await Promise.all([
    prisma.inspection.findFirst({
      where: { id: inspectionId, bonId },
      include: {
        points: { orderBy: { ordre: "asc" }, include: { photos: { select: { id: true }, orderBy: { ajouteeLe: "asc" } } } },
        bon: {
          select: {
            id: true, numero: true, clientNomAffiche: true,
            client: { select: { nom: true, telephone: true, courriel: true } },
            vehicule: true,
          },
        },
      },
    }),
    bonEstVerrouille(bonId),
    aAccesSection(session, "operations"),
    lireParametres(["tps_taux", "tvq_taux"]),
    obtenirInfosEntreprise(),
    lireSeuils(), // états proposés selon la mesure
  ]);
  if (!inspection) notFound();
  // Ce que la dernière inspection de ce véhicule avait noté, point par point
  const historique = await historiquePoints(inspection.bon.vehicule?.id, { inspectionId: inspection.id, avant: inspection.creeLe });

  const { jetonClient, ...reste } = inspection;
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <InspectionClient
        inspection={reste}
        lien={jetonClient ? lienInspection(jetonClient) : null}
        verrouille={verrouille}
        comptoir={comptoir}
        taux={{ tpsTaux: Number(dict.tps_taux || 5), tvqTaux: Number(dict.tvq_taux || 9.975) }}
        nomEntreprise={nomEntreprise}
        seuils={seuils}
        historique={historique}
      />
    </div>
  );
}
