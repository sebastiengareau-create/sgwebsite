import { routesElement } from "@/lib/immobilierRoutes";
import { aviserLocataireReparation } from "@/lib/immobilier";
import { STATUTS_REPARATION, libelle, dateLisible } from "@/lib/immobilierCalculs";

// Passée à « Terminée » sans date de fin : aujourd'hui. Le locataire qui l'a
// demandée est avisé par courriel quand l'état, la date prévue ou la réponse
// changent (voir aviserLocataireReparation).
export const { PATCH, DELETE } = routesElement("reparationImmo", "reparation", {
  avant: (data, { element }) => {
    if (data.statut === "TERMINEE" && !element.dateFin && data.dateFin === undefined) data.dateFin = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  },
  apres: async (r, { avant }) => {
    if (!r.locataireId) return;
    const messages = [];
    if (r.statut !== avant.statut) messages.push(`Nouvel état : ${libelle(STATUTS_REPARATION, r.statut)}.`);
    if (r.datePrevue && String(r.datePrevue) !== String(avant.datePrevue)) messages.push(`Travaux prévus le ${dateLisible(r.datePrevue)}.`);
    if (r.reponse && r.reponse !== avant.reponse) messages.push(r.reponse);
    if (messages.length > 0) await aviserLocataireReparation(r.id, messages.join("\n\n"));
  },
});
