import { routesCollection } from "@/lib/immobilierRoutes";

export const { POST } = routesCollection("paiementImmo", "paiement", {
  avant: (data, { session }) => { data.creePar = session.nom; },
});
