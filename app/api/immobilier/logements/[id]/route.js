import { prisma } from "@/lib/prisma";
import { routesElement } from "@/lib/immobilierRoutes";

// Un logement qui a eu des baux reste : l'historique des loyers en dépend
export const { PATCH, DELETE } = routesElement("logementImmo", "logement", {
  doublon: "Cet immeuble a déjà un logement à ce numéro.",
  avantSuppression: async (l) => {
    if (await prisma.bailImmo.count({ where: { logementId: l.id } })) return { erreur: "Ce logement a des baux : sa fiche reste pour l'historique." };
  },
});
