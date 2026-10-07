// ============================================================
// COMMANDES FOURNISSEURS — statuts et quantités en commande
// ============================================================
// BROUILLON → ENVOYEE → RECUE_PARTIELLE → RECUE. Une commande se modifie
// librement tant qu'aucune réception n'a eu lieu ; chaque réception crée
// une dépense à payer (voir app/api/commandes-fournisseurs/[id]/reception).
// ============================================================

export const STATUTS_COMMANDE = {
  BROUILLON: { label: "Brouillon", couleur: "var(--text-muted)" },
  // « Commande passée » : commandée chez le fournisseur (en ligne, au
  // comptoir, au téléphone…) — d'ici là, le brouillon accueille les pièces
  ENVOYEE: { label: "Commande passée", couleur: "var(--accent)" },
  RECUE_PARTIELLE: { label: "Reçue en partie", couleur: "#C9A227" },
  RECUE: { label: "Reçue", couleur: "var(--success)" },
  ANNULEE: { label: "Annulée", couleur: "var(--danger)" },
};

// Commandes dont la marchandise est attendue : leur reste compte comme
// « en commande » dans l'inventaire.
export const STATUTS_EN_ATTENTE = ["ENVOYEE", "RECUE_PARTIELLE"];

export function resteARecevoir(ligne) {
  return Math.max(0, ligne.qteCommandee - ligne.qteRecue);
}

// Quantité attendue par pièce, toutes commandes envoyées confondues (avec
// avecBrouillons, aussi celles pas encore envoyées).
export async function quantitesEnCommande(prisma, pieceIds, { avecBrouillons = false } = {}) {
  const lignes = await prisma.ligneCommandeFournisseur.findMany({
    where: {
      commande: { statut: { in: avecBrouillons ? [...STATUTS_EN_ATTENTE, "BROUILLON"] : STATUTS_EN_ATTENTE } },
      ...(pieceIds && { pieceId: { in: pieceIds } }),
    },
    select: { pieceId: true, qteCommandee: true, qteRecue: true },
  });
  const parPiece = {};
  for (const l of lignes) parPiece[l.pieceId] = (parPiece[l.pieceId] || 0) + resteARecevoir(l);
  return parPiece;
}

// Quantité à commander pour ramener une pièce à son seuil maximum (ou, à
// défaut, juste au-dessus du minimum), en tenant compte de ce qui est déjà
// en route. 0 = rien à commander.
export function quantiteSuggeree(piece, enCommande = 0) {
  const disponible = piece.qte + enCommande;
  if (disponible > piece.qteMin) return 0;
  const cible = piece.qteMax != null && piece.qteMax > piece.qteMin ? piece.qteMax : piece.qteMin + 1;
  return Math.max(1, cible - disponible);
}
