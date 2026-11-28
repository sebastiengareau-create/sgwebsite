import { routesCollection } from "@/lib/coproprieteRoutes";
import { verifierNumeroUnite } from "@/lib/copropriete";

// Numéro unique dans son bâtiment : une unité 101 dans chaque bâtiment
export const { POST } = routesCollection("uniteCopro", "unite", {
  doublon: "Une unité porte déjà ce numéro dans ce bâtiment.",
  avant: async (data) => {
    const erreur = await verifierNumeroUnite({ numero: data.numero, batimentId: data.batimentId });
    if (erreur) return { erreur };
  },
});
