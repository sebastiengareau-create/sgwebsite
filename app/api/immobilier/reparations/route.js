import { routesCollection } from "@/lib/immobilierRoutes";
import { creerReparation, appliquerFournisseur } from "@/lib/immobilier";

export const { POST } = routesCollection("reparationImmo", "reparation", {
  avant: (data, { session }) => {
    data.creePar = session.nom;
    return appliquerFournisseur(data, "entrepreneur");
  },
  creer: (data) => creerReparation(data),
});
