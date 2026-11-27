import { prisma } from "@/lib/prisma";
import { routesElement } from "@/lib/immobilierRoutes";
import { verrouSignature } from "@/lib/signatureImmo";

// Un immeuble qui a encore des logements reste : on retire d'abord ses
// logements (qui gardent l'historique de leurs baux)
export const { PATCH, DELETE } = routesElement("immeubleImmo", "immeuble", {
  avantSuppression: async (i) => {
    if (await prisma.logementImmo.count({ where: { immeubleId: i.id } })) return { erreur: "Cet immeuble a encore des logements : retire-les d'abord." };
    // ses documents partiraient avec lui
    return verrouSignature({ immeubleId: i.id });
  },
});
