import { routesCollection } from "@/lib/coproprieteRoutes";
import { verifierBudgetUnique } from "@/lib/copropriete";

// Un budget par exercice et par bâtiment (sans bâtiment : la copropriété entière)
export const { POST } = routesCollection("budgetCopro", "budget", {
  doublon: "Le budget de cet exercice existe déjà pour ce bâtiment.",
  avant: async (data) => {
    const erreur = await verifierBudgetUnique({ annee: data.annee, batimentId: data.batimentId });
    if (erreur) return { erreur };
  },
});
