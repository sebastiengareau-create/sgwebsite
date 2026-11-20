import { routesCollection } from "@/lib/immobilierRoutes";
import { creerReparation } from "@/lib/immobilier";

export const { POST } = routesCollection("reparationImmo", "reparation", {
  avant: (data, { session }) => { data.creePar = session.nom; },
  creer: (data) => creerReparation(data),
});
