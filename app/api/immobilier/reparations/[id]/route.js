import { routesElement } from "@/lib/immobilierRoutes";

// Passée à « Terminée » sans date de fin : aujourd'hui
export const { PATCH, DELETE } = routesElement("reparationImmo", "reparation", {
  avant: (data, { element }) => {
    if (data.statut === "TERMINEE" && !element.dateFin && data.dateFin === undefined) data.dateFin = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  },
});
