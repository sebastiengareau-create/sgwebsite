import { prisma } from "@/lib/prisma";
import { routesElement } from "@/lib/coproprieteRoutes";
import { aviserDemandeur, STATUT_DEMANDE_SELON_TRAVAIL } from "@/lib/copropriete";
import { libelle, STATUTS_TRAVAIL, ajouterMois } from "@/lib/coproprieteCalculs";

// Un changement de statut est noté au suivi du bon, fait avancer la demande
// d'origine (et en avise le copropriétaire) ; terminé, il reporte
// l'entretien préventif d'origine à sa prochaine échéance.
export const { PATCH, DELETE } = routesElement("travailCopro", "travail", {
  avant: (data, { element }) => {
    if (data.statut === "TERMINE" && element.statut !== "TERMINE" && data.dateFin === undefined && !element.dateFin) data.dateFin = new Date();
  },
  apres: async (t, { session, body, avant }) => {
    if (t.statut === avant.statut) return;
    const note = typeof body.noteStatut === "string" ? body.noteStatut.trim().slice(0, 4000) : "";
    await prisma.suiviTravailCopro.create({
      data: { travailId: t.id, statut: t.statut, texte: note || `Statut : ${libelle(STATUTS_TRAVAIL, t.statut)}.`, auteur: session.nom, public: body.notePublique !== false },
    });
    if (t.demandeId && STATUT_DEMANDE_SELON_TRAVAIL[t.statut]) {
      const d = await prisma.demandeCopro.findUnique({ where: { id: t.demandeId }, select: { statut: true } });
      const nouveau = STATUT_DEMANDE_SELON_TRAVAIL[t.statut];
      if (d && d.statut !== nouveau && d.statut !== "REFUSEE") {
        await prisma.demandeCopro.update({ where: { id: t.demandeId }, data: { statut: nouveau } });
      }
      const messages = {
        PLANIFIE: `Les travaux sont planifiés${t.datePrevue ? ` pour le ${t.datePrevue.toISOString().slice(0, 10)}` : ""}.`,
        EN_COURS: "Les travaux sont commencés.",
        TERMINE: "Les travaux sont terminés.",
      };
      if (messages[t.statut] && body.notePublique !== false) await aviserDemandeur(t.demandeId, [messages[t.statut], note].filter(Boolean).join("\n\n"));
    }
    if (t.statut === "TERMINE" && t.entretienId) {
      const e = await prisma.entretienCopro.findUnique({ where: { id: t.entretienId } });
      if (e) {
        const fait = t.dateFin || new Date();
        await prisma.entretienCopro.update({ where: { id: e.id }, data: { derniereDate: fait, prochaineDate: ajouterMois(fait, e.frequenceMois) } });
      }
    }
  },
});
