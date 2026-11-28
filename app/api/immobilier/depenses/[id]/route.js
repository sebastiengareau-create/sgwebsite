import { routesElement } from "@/lib/immobilierRoutes";
import { appliquerFournisseur } from "@/lib/immobilier";

export const { PATCH, DELETE } = routesElement("depenseImmo", "depense", {
  avant: (data) => appliquerFournisseur(data, "payeA"),
});
