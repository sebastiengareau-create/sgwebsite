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

// Commandes ouvertes (brouillon, passée, reçue en partie) où une pièce est
// déjà attendue, avec ce qui en reste de libre : le reste à recevoir moins
// ce que des pièces B/O de bons attendent déjà de cette commande. Une pièce
// manquante sur un bon peut se mettre en B/O sur une de ces commandes plutôt
// que d'en commander une de plus. Les plus libres d'abord.
export async function commandesOuvertesPourPiece(db, pieceId) {
  const lignes = await db.ligneCommandeFournisseur.findMany({
    where: { pieceId, commande: { statut: { in: ["BROUILLON", ...STATUTS_EN_ATTENTE] } } },
    select: {
      qteCommandee: true, qteRecue: true,
      commande: { select: { id: true, numero: true, statut: true, fournisseurId: true, fournisseur: { select: { nom: true } } } },
    },
  });
  const parCommande = new Map();
  for (const l of lignes) {
    const c = parCommande.get(l.commande.id) || { ...l.commande, fournisseur: l.commande.fournisseur.nom, reste: 0, reserve: 0 };
    c.reste += resteARecevoir(l);
    parCommande.set(c.id, c);
  }
  if (parCommande.size === 0) return [];
  const reservees = await db.pieceACommander.findMany({
    where: { pieceId, commandeId: { in: [...parCommande.keys()] }, pieceUtilisee: { is: { bo: true } } },
    select: { commandeId: true, pieceUtilisee: { select: { qte: true } } },
  });
  for (const r of reservees) parCommande.get(r.commandeId).reserve += r.pieceUtilisee.qte;
  return [...parCommande.values()]
    .map((c) => ({ ...c, libre: Math.max(0, c.reste - c.reserve) }))
    .filter((c) => c.reste > 0)
    .sort((a, b) => b.libre - a.libre);
}
