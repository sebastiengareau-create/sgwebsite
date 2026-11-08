import { prisma } from "@/lib/prisma";
import { routesCollection } from "@/lib/coproprieteRoutes";
import { creerTravail, aviserDemandeur } from "@/lib/copropriete";

// Nouveau bon de travail. Créé depuis une demande, il en reprend l'endroit
// et la catégorie, et la demande passe à « Acceptée » ; depuis un entretien
// préventif, il en reprend le fournisseur et le coût estimé.
export const { POST } = routesCollection("travailCopro", "travail", {
  avant: async (data) => {
    if (data.demandeId) {
      const d = await prisma.demandeCopro.findUnique({ where: { id: data.demandeId } });
      if (!d) return { erreur: "Demande introuvable." };
      for (const champ of ["batimentId", "uniteId", "emplacement", "categorie"]) if (data[champ] == null) data[champ] = d[champ];
      if (!data.priorite) data.priorite = d.priorite;
    }
    if (data.entretienId) {
      const e = await prisma.entretienCopro.findUnique({ where: { id: data.entretienId } });
      if (!e) return { erreur: "Entretien introuvable." };
      for (const champ of ["batimentId", "emplacement", "categorie", "fournisseurId", "coutEstime"]) if (data[champ] == null) data[champ] = e[champ];
      if (!data.datePrevue) data.datePrevue = e.prochaineDate;
    }
  },
  creer: async (data, { session }) => {
    const statut = data.statut || (data.fournisseurId && data.datePrevue ? "PLANIFIE" : "A_PLANIFIER");
    const travail = await creerTravail({
      ...data, statut, creePar: session.nom,
      suivis: { create: { statut, texte: "Bon de travail créé.", auteur: session.nom } },
    });
    if (data.demandeId) {
      const d = await prisma.demandeCopro.findUnique({ where: { id: data.demandeId }, select: { statut: true } });
      if (d?.statut === "NOUVELLE") {
        await prisma.demandeCopro.update({ where: { id: data.demandeId }, data: { statut: "ACCEPTEE" } });
        await aviserDemandeur(data.demandeId, "Votre demande a été acceptée et un bon de travail a été ouvert.");
      }
    }
    return travail;
  },
});
