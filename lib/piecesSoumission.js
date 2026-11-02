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
  const lignes = pr.pieces || [];
  if (lignes.length > 0) {
    const qte = lignes.reduce((s, l) => s + l.qte, 0);
    const total = lignes.reduce((s, l) => s + l.qte * l.prix, 0);
    return { id: pr.id, nom: pr.description, numero: lignes[0].piece?.numero, qte, prix: qte ? total / qte : lignes[0].prix, total };
  }
  const qte = pr.factureQte ?? 1;
  const prix = pr.facturePrixUnitaire || 0;
  return { id: pr.id, nom: pr.description, qte, prix, total: qte * prix };
}
