// Pièces d'une soumission facturée telle quelle (profil
// soumissionFacturerDirect, app/api/soumissions/[id]/facturer) : chacune est
// une tâche du bon avec une ligne de facturation fixe au compte 4010 — pas
// une pièce d'inventaire. À l'écran, à l'impression et dans le PDF, elles
// sont regroupées dans une section « Pièces » au début, avant les tâches,
// comme sur la soumission. Une pièce choisie dans l'inventaire porte en plus
// la pièce du bon sortie du stock (PieceUtilisee, pour le coût des pièces
// vendues) : son montant vient de là, la ligne fixe restant à 0. Ces pièces
// ne s'affichent donc qu'ici, pas dans la liste des pièces du bon. Client et
// serveur.
//
// Pièces hors inventaire : même ligne fixe au compte 4010, ajoutée à la main
// sur un bon (POST /api/bons/[id]/pieces-hors-inventaire) pour une pièce
// achetée pour ce bon seulement — sans fiche ni mouvement de stock. Elle
// porte en plus son coûtant (factureCoutant, unitaire) : à la facture, il va
// au coût des pièces vendues (5000) contre l'inventaire (1200), où l'achat se
// saisit (comptes à payer, « Réception d'inventaire (actif) »).

export const COMPTE_PIECES_SOUMISSION = "4010";

// Filtre Prisma des tâches d'un bon sans ces lignes de pièces — pour les
// écrans où l'on travaille sur les tâches (mécaniciens, envois)
export const TACHES_SEULEMENT = { categorieRevenu: { not: COMPTE_PIECES_SOUMISSION } };

export function estLignePieceSoumission(probleme) {
  return probleme.categorieRevenu === COMPTE_PIECES_SOUMISSION;
}

// { pieces, taches } : les lignes de pièces d'abord, les vraies tâches ensuite
export function separerPiecesSoumission(problemes) {
  return {
    pieces: problemes.filter(estLignePieceSoumission),
    taches: problemes.filter((pr) => !estLignePieceSoumission(pr)),
  };
}

// Ligne affichée : nom de la pièce, quantité telle qu'entrée (0 compris)
export function ligneDePieceSoumission(pr) {
  const lignes = pr.pieces || [];
  if (lignes.length > 0) {
    const qte = lignes.reduce((s, l) => s + l.qte, 0);
    const total = lignes.reduce((s, l) => s + l.qte * l.prix, 0);
    return { id: pr.id, nom: pr.description, numero: lignes[0].piece?.numero, qte, prix: qte ? total / qte : lignes[0].prix, total };
  }
  const qte = pr.factureQte ?? 1;
  const prix = pr.facturePrixUnitaire || 0;
  return { id: pr.id, nom: pr.description, qte, prix, total: qte * prix, coutant: pr.factureCoutant ?? null };
}

// Montant facturé d'une ligne fixe (prix unitaire × quantité)
export function montantLigneFixe(pr) {
  return (pr.facturePrixUnitaire || 0) * (pr.factureQte ?? 1);
}

// Lignes fixes d'un bon pas encore facturé : { pieces, autres } — les pièces
// (compte 4010) comptent avec les pièces de la facture, les autres postes
// (remorquage, alignement…) dans les autres revenus
export function totauxLignesFixes(problemes) {
  const totaux = { pieces: 0, autres: 0 };
  for (const pr of problemes) {
    if ((pr.categorieRevenu || "MAIN_OEUVRE") === "MAIN_OEUVRE") continue;
    totaux[estLignePieceSoumission(pr) ? "pieces" : "autres"] += montantLigneFixe(pr);
  }
  return totaux;
}

// Coûtant des pièces hors inventaire d'un bon (factureCoutant × quantité)
export function coutLignesPieces(problemes) {
  return problemes
    .filter(estLignePieceSoumission)
    .reduce((s, pr) => s + (pr.factureCoutant || 0) * (pr.factureQte ?? 1), 0);
}

// Pièce hors inventaire envoyée par le formulaire du bon → { data } (champs
// de la ligne) ou { erreur } : description, quantité, prix de vente unitaire
// et coûtant unitaire (facultatif).
export function lirePieceHorsInventaire(body) {
  const description = String(body.description || "").trim();
  if (!description) return { erreur: "Description requise." };
  const nombre = (v) => Number(String(v ?? "").replace(",", "."));
  const qte = nombre(body.qte);
  const prix = nombre(body.prix);
  const coutant = String(body.coutant ?? "").trim() === "" ? null : nombre(body.coutant);
  if (!Number.isFinite(qte) || qte <= 0) return { erreur: "Quantité invalide." };
  if (!Number.isFinite(prix) || prix < 0) return { erreur: "Prix de vente invalide." };
  if (coutant !== null && (!Number.isFinite(coutant) || coutant < 0)) return { erreur: "Coûtant invalide." };
  return { data: { description, factureQte: qte, facturePrixUnitaire: prix, factureCoutant: coutant } };
}
