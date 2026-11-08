import { prisma } from "@/lib/prisma";
import { routesCollection } from "@/lib/coproprieteRoutes";

// Ajoute un propriétaire à une unité. Avec { transfert: true } (vente de
// l'unité), les propriétaires actuels sortent à la date d'acquisition du
// nouveau : l'historique des propriétaires se tient tout seul.
export const { POST } = routesCollection("proprieteCopro", "propriete", {
  avant: async (data) => {
    if (data.dateFin) return;
    const deja = await prisma.proprieteCopro.findFirst({ where: { uniteId: data.uniteId, coproprietaireId: data.coproprietaireId, dateFin: null } });
    if (deja) return { erreur: "Ce copropriétaire est déjà propriétaire de cette unité." };
  },
  creer: (data, { body }) => prisma.$transaction(async (tx) => {
    if (body.transfert) {
      await tx.proprieteCopro.updateMany({
        where: { uniteId: data.uniteId, dateFin: null, coproprietaireId: { not: data.coproprietaireId } },
        data: { dateFin: data.dateDebut || new Date() },
      });
    }
    return tx.proprieteCopro.create({ data });
  }),
});
