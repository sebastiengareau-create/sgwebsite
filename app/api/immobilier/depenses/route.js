import { routesCollection } from "@/lib/immobilierRoutes";

export const { POST } = routesCollection("depenseImmo", "depense", {
  avant: (data, { session }) => { data.creePar = session.nom; },
});
