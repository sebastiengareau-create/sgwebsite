// Pièces présentées dans le rapport d'inventaire (page, PDF, Excel).
// Une pièce désactivée sans stock n'a plus rien à y faire; si elle a encore
// du stock, elle reste — le total doit concorder avec le compte 1200.
export const FILTRE_PIECES_RAPPORT = { OR: [{ actif: true }, { qte: { not: 0 } }] };

export function libellePieceRapport(p) {
  return p.actif ? p.nom : `${p.nom} (désactivée)`;
}
