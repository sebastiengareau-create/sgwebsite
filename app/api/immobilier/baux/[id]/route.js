import { prisma } from "@/lib/prisma";
import { routesElement } from "@/lib/immobilierRoutes";
import { locatairesDuBail } from "@/lib/immobilier";

// Modification d'un bail ; avec locataireIds (et/ou nouveauLocataire), la
// liste des locataires est remplacée
export const { PATCH, DELETE } = routesElement("bailImmo", "bail", {
  avant: async (data, { body }) => {
    if (body.locataireIds === undefined && !body.nouveauLocataire) return;
    const r = await locatairesDuBail(body);
    if (r.erreur) return r;
    if (r.ids.length === 0) return { erreur: "Un bail garde au moins un locataire." };
    data.locataires = { set: r.ids.map((id) => ({ id })) };
  },
  avantSuppression: async (b) => {
    if (await prisma.paiementImmo.count({ where: { bailId: b.id } })) return { erreur: "Ce bail a des paiements : termine-le plutôt, son historique reste." };
  },
});
