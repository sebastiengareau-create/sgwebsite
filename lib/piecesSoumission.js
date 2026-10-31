// Pièces d'une soumission facturée telle quelle (profil
// soumissionFacturerDirect, app/api/soumissions/[id]/facturer) : chacune est
// une tâche du bon avec une ligne de facturation fixe au compte 4010 — pas
// une pièce d'inventaire. À l'écran, à l'impression et dans le PDF, elles
// sont regroupées dans une section « Pièces » au début, avant les tâches,
// comme sur la soumission. Client et serveur.

export const COMPTE_PIECES_SOUMISSION = "4010";

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
  const qte = pr.factureQte ?? 1;
  const prix = pr.facturePrixUnitaire || 0;
  return { id: pr.id, nom: pr.description, qte, prix, total: qte * prix };
}
