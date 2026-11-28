import { routesElement } from "@/lib/coproprieteRoutes";
import { verifierBudgetUnique } from "@/lib/copropriete";

// Un budget par exercice et par bâtiment (sans bâtiment : la copropriété entière)
export const { PATCH, DELETE } = routesElement("budgetCopro", "budget", {
  doublon: "Le budget de cet exercice existe déjà pour ce bâtiment.",
  avant: async (data, { element }) => {
    if (data.annee === undefined && data.batimentId === undefined) return;
    const erreur = await verifierBudgetUnique({
      annee: data.annee ?? element.annee,
      batimentId: data.batimentId !== undefined ? data.batimentId : element.batimentId,
      id: element.id,
    });
    if (erreur) return { erreur };
  },
});
