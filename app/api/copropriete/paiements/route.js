import { routesCollection } from "@/lib/coproprieteRoutes";

export const { POST } = routesCollection("paiementCopro", "paiement", {
  avant: (data, { session }) => { data.creePar = session.nom; },
});
