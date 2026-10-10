// Fiche précédente / suivante dans une liste ordonnée d'identifiants —
// commun à la page serveur (ordre par défaut de la liste) et au bouton
// (ordre mémorisé de la liste telle qu'affichée, filtres compris).
export function voisinsFiche(ids, id) {
  const index = ids.indexOf(id);
  if (index < 0) return null;
  return {
    precedent: index > 0 ? ids[index - 1] : null,
    suivant: index < ids.length - 1 ? ids[index + 1] : null,
    position: index + 1,
    total: ids.length,
  };
}
