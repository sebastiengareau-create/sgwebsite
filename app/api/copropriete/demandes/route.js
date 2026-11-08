import { routesCollection } from "@/lib/coproprieteRoutes";
import { creerDemande } from "@/lib/copropriete";

// Demande de réparation ou signalement entré par l'équipe (appel,
// courriel…) ; les photos suivent par /api/copropriete/fichiers
export const { POST } = routesCollection("demandeCopro", "demande", {
  creer: (data, { session }) => creerDemande({ ...data, statut: "NOUVELLE", source: "INTERNE", creePar: session.nom }),
});
