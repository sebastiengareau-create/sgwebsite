import { prisma } from "@/lib/prisma";
import { routesElement } from "@/lib/coproprieteRoutes";

// Supprimer un bâtiment laisse ses unités, demandes et documents en place,
// sans bâtiment — refusé si l'une de ses unités porterait alors le numéro
// d'une unité déjà sans bâtiment (numéro unique dans son bâtiment)
export const { PATCH, DELETE } = routesElement("batimentCopro", "batiment", {
  avantSuppression: async (b) => {
    const siennes = await prisma.uniteCopro.findMany({ where: { batimentId: b.id }, select: { numero: true } });
    if (siennes.length === 0) return;
    const conflits = await prisma.uniteCopro.findMany({ where: { batimentId: null, numero: { in: siennes.map((u) => u.numero) } }, select: { numero: true } });
    if (conflits.length) return { erreur: `Une unité sans bâtiment porte déjà le numéro ${conflits.map((u) => u.numero).join(", ")} : déplace ces unités dans un autre bâtiment avant de supprimer ${b.nom}.` };
  },
});
