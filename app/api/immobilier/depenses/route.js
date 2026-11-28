import { routesCollection } from "@/lib/immobilierRoutes";
import { appliquerFournisseur } from "@/lib/immobilier";

// Avec l'Immobilier relié à la comptabilité : { payee: true, modePaiement }
// paie tout de suite la facture aux comptes à payer (lib/immobilierRoutes.js)
export const { POST } = routesCollection("depenseImmo", "depense", {
  avant: (data, { session }) => {
    data.creePar = session.nom;
    return appliquerFournisseur(data, "payeA");
  },
});
