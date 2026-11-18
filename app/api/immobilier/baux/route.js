import { prisma } from "@/lib/prisma";
import { routesCollection } from "@/lib/immobilierRoutes";
import { locatairesDuBail } from "@/lib/immobilier";

// Nouveau bail : logement, dates, loyer… plus locataireIds (locataires déjà
// inscrits) et/ou nouveauLocataire { nom, telephone, courriel } créé du même
// coup. Un logement n'a qu'un bail en cours à la fois.
export const { POST } = routesCollection("bailImmo", "bail", {
  avant: async (data, { body }) => {
    const enCours = await prisma.bailImmo.findFirst({ where: { logementId: data.logementId, statut: "ACTIF" }, select: { id: true } });
    if (enCours) return { erreur: "Ce logement a déjà un bail en cours : termine-le ou renouvelle-le d'abord." };
    const r = await locatairesDuBail(body);
    if (r.erreur) return r;
    if (r.ids.length === 0) return { erreur: "Inscris au moins un locataire." };
    data.locataires = { connect: r.ids.map((id) => ({ id })) };
  },
});
