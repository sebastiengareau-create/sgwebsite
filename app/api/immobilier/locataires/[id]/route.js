import { prisma } from "@/lib/prisma";
import { routesElement } from "@/lib/immobilierRoutes";

export const { PATCH, DELETE } = routesElement("locataireImmo", "locataire", {
  avantSuppression: async (l) => {
    if (await prisma.bailImmo.count({ where: { locataires: { some: { id: l.id } } } })) return { erreur: "Ce locataire est inscrit à un bail : sa fiche reste pour l'historique." };
  },
});
