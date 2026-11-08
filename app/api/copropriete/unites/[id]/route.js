import { prisma } from "@/lib/prisma";
import { routesElement } from "@/lib/coproprieteRoutes";

// Une unité qui a un compte (charges ou paiements) reste : son historique
// financier en dépend
export const { PATCH, DELETE } = routesElement("uniteCopro", "unite", {
  doublon: "Une unité porte déjà ce numéro.",
  avantSuppression: async (u) => {
    const [charges, paiements] = await Promise.all([
      prisma.chargeCopro.count({ where: { uniteId: u.id } }),
      prisma.paiementCopro.count({ where: { uniteId: u.id } }),
    ]);
    if (charges + paiements > 0) return { erreur: "Cette unité a des charges ou des paiements : sa fiche reste pour l'historique." };
  },
});
