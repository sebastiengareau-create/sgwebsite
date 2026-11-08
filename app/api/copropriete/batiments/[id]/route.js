import { routesElement } from "@/lib/coproprieteRoutes";

// Supprimer un bâtiment laisse ses unités, demandes et documents en place,
// sans bâtiment
export const { PATCH, DELETE } = routesElement("batimentCopro", "batiment");
