import { routesElement } from "@/lib/coproprieteRoutes";
import { aviserDemandeur } from "@/lib/copropriete";
import { libelle, STATUTS_DEMANDE } from "@/lib/coproprieteCalculs";

// Changer le statut ou la réponse avise le copropriétaire qui a fait la
// demande (courriel, et visible dans son portail)
export const { PATCH, DELETE } = routesElement("demandeCopro", "demande", {
  apres: async (d, { avant }) => {
    const statutChange = d.statut !== avant.statut;
    const reponseChange = d.reponse && d.reponse !== avant.reponse;
    if (!statutChange && !reponseChange) return;
    const message = [statutChange && `Votre demande est maintenant : ${libelle(STATUTS_DEMANDE, d.statut).toLowerCase()}.`, reponseChange && d.reponse].filter(Boolean).join("\n\n");
    await aviserDemandeur(d.id, message);
  },
});
