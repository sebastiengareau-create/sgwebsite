import { routesElement } from "@/lib/immobilierRoutes";

// Modifier ou supprimer un entretien ; ses interventions (réparations) restent
export const { PATCH, DELETE } = routesElement("entretienImmo", "entretien");
