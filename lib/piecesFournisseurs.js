import { prisma } from "./prisma";

// Message clair quand un numéro fournisseur est déjà pris : c'est
// justement le signe d'un doublon dans l'inventaire.
export async function messageDoublon(e, fournisseurId, numeroFournisseur) {
  if (String(e.meta?.target || "").includes("numeroFournisseur")) {
    const autre = await prisma.pieceFournisseur.findFirst({
      where: { fournisseurId, numeroFournisseur: numeroFournisseur?.trim() },
      include: { piece: true },
    });
    return `Ce numéro est déjà celui de « ${autre?.piece.nom || "une autre pièce"} » (${autre?.piece.numero || "?"}) chez ce fournisseur. Si c'est la même pièce, fusionne les deux fiches.`;
  }
  return "Cette pièce est déjà liée à ce fournisseur — modifie le lien existant.";
}
