import { routesElement } from "@/lib/coproprieteRoutes";

// Supprimer un copropriétaire efface aussi son historique de propriété ;
// ses demandes restent, sans lui
export const { PATCH, DELETE } = routesElement("coproprietaireCopro", "coproprietaire");
