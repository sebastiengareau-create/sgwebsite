// Pièces présentées dans le rapport d'inventaire (page, PDF, Excel).
// Une pièce désactivée sans stock n'a plus rien à y faire; si elle a encore
// du stock, elle reste — le total doit concorder avec le compte 1200.
export const FILTRE_PIECES_RAPPORT = { OR: [{ actif: true }, { qte: { not: 0 } }] };

// Ordre des pièces (liste de l'inventaire, rapport) : par numéro de
// référence par défaut. « 10 » vient après « 9 » (comparaison numérique).
// Par fournisseur : le fournisseur habituel (piece.fournisseur inclus) ; les
// pièces sans fournisseur vont à la fin.
const comparerTexte = (a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });
export const TRIS_PIECES = {
  numero: { libelle: "Numéro de référence", comparer: (a, b) => comparerTexte(a.numero, b.numero) },
  description: { libelle: "Description", comparer: (a, b) => comparerTexte(a.nom, b.nom) || comparerTexte(a.numero, b.numero) },
  fournisseur: {
    libelle: "Fournisseur",
    comparer: (a, b) => (!a.fournisseur - !b.fournisseur)
      || comparerTexte(a.fournisseur?.nom || "", b.fournisseur?.nom || "")
      || comparerTexte(a.numero, b.numero),
  },
};
// Tri reçu (?tri=…) → clé valide, « numero » sinon
export function cleTri(tri) {
  return Object.hasOwn(TRIS_PIECES, tri ?? "") ? tri : "numero";
}
// Les pièces en stock d'abord, puis celles à 0 (ou moins) ; chaque groupe
// dans le tri choisi
export function comparateurPieces(tri) {
  const comparer = TRIS_PIECES[cleTri(tri)].comparer;
  return (a, b) => (b.qte > 0) - (a.qte > 0) || comparer(a, b);
}
export function trierPieces(pieces, tri) {
  return [...pieces].sort(comparateurPieces(tri));
}
// Liens fournisseurs et fournisseur habituel, pour le rapport et son tri
export const INCLUDE_PIECES_RAPPORT = { fournisseur: { select: { nom: true } }, fournisseurs: { include: { fournisseur: true } } };

export function libellePieceRapport(p) {
  return p.actif ? p.nom : `${p.nom} (désactivée)`;
}

// « NAPA : NAPA-FIL-1 · Interstate : INT-55432 » — numéros de la pièce chez
// ses fournisseurs (liens avec fournisseur inclus), habituel en premier.
export function libelleNumerosFournisseurs(piece, separateur = " · ") {
  return [...(piece.fournisseurs || [])]
    .filter((l) => l.numeroFournisseur)
    .sort((a, b) => (b.fournisseurId === piece.fournisseurId) - (a.fournisseurId === piece.fournisseurId) || a.fournisseur.nom.localeCompare(b.fournisseur.nom, "fr"))
    .map((l) => `${l.fournisseur.nom} : ${l.numeroFournisseur}`)
    .join(separateur);
}

// Rapport d'inventaire par fournisseur : pour chaque fournisseur, les pièces
// qu'il vend (liées à lui, ou dont il est le fournisseur habituel) avec son
// numéro et son dernier prix. Une pièce vendue par deux fournisseurs paraît
// sous chacun ; le total général, lui, compte chaque pièce une seule fois
// (il concorde avec le rapport d'inventaire et le compte 1200).
// fournisseurId : un seul fournisseur, ou null pour tous (avec, à la fin,
// les pièces sans aucun fournisseur).
export async function construireRapportParFournisseur(prisma, fournisseurId = null) {
  const [pieces, fournisseurs] = await Promise.all([
    prisma.piece.findMany({
      where: FILTRE_PIECES_RAPPORT,
      include: { fournisseurs: { include: { fournisseur: true } } },
      orderBy: { nom: "asc" },
    }),
    prisma.fournisseur.findMany({ where: fournisseurId ? { id: fournisseurId } : {}, orderBy: { nom: "asc" } }),
  ]);

  const ligne = (p, lien, fournisseur) => ({
    pieceId: p.id,
    numero: p.numero,
    nom: libellePieceRapport(p),
    numeroFournisseur: lien?.numeroFournisseur || null,
    habituel: fournisseur ? p.fournisseurId === fournisseur.id : false,
    qte: p.qte,
    qteMin: p.qteMin,
    dernierPrix: lien?.coutant ?? null,
    dernierAchat: lien?.dernierAchat ?? null,
    coutant: p.coutant,
    valeur: p.qte * p.coutant,
  });
  const totaliser = (fournisseur, lignes) => ({
    fournisseur: fournisseur ? { id: fournisseur.id, nom: fournisseur.nom, actif: fournisseur.actif } : null,
    lignes,
    totalQte: lignes.reduce((s, l) => s + l.qte, 0),
    totalValeur: lignes.reduce((s, l) => s + l.valeur, 0),
  });

  const groupes = [];
  for (const f of fournisseurs) {
    const lignes = pieces
      .map((p) => ({ p, lien: p.fournisseurs.find((l) => l.fournisseurId === f.id) }))
      .filter(({ p, lien }) => lien || p.fournisseurId === f.id)
      .map(({ p, lien }) => ligne(p, lien, f));
    // Un fournisseur sans aucune pièce n'encombre pas le rapport complet
    if (lignes.length > 0 || fournisseurId) groupes.push(totaliser(f, lignes));
  }
  const piecesRetenues = fournisseurId
    ? pieces.filter((p) => p.fournisseurId === fournisseurId || p.fournisseurs.some((l) => l.fournisseurId === fournisseurId))
    : pieces;
  if (!fournisseurId) {
    const sansFournisseur = pieces.filter((p) => !p.fournisseurId && p.fournisseurs.length === 0);
    if (sansFournisseur.length > 0) groupes.push(totaliser(null, sansFournisseur.map((p) => ligne(p, null, null))));
  }

  return {
    groupes,
    totalPieces: piecesRetenues.length,
    totalQte: piecesRetenues.reduce((s, p) => s + p.qte, 0),
    totalValeur: piecesRetenues.reduce((s, p) => s + p.qte * p.coutant, 0),
  };
}
