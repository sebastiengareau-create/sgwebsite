// ============================================================
// CODES-BARRES DES PIÈCES — lecture d'un scan (client et serveur)
// ============================================================
// Un scan peut donner trois choses :
//  - le QR d'une étiquette imprimée par l'appli : l'adresse de la fiche
//    (…/secretaire/inventaire/<id>), lisible aussi par l'appareil photo
//    du téléphone, sans passer par l'appli ;
//  - le code-barres du fabricant sur la boîte (UPC/EAN), noté dans le
//    champ codeBarre de la pièce ;
//  - le numéro de la pièce lui-même (code 128 d'un fournisseur, saisie).
// ============================================================

export const CHEMIN_FICHE_PIECE = "/secretaire/inventaire/";

// Adresse encodée dans le QR d'une étiquette.
export function urlEtiquettePiece(origine, pieceId) {
  return `${origine.replace(/\/+$/, "")}${CHEMIN_FICHE_PIECE}${pieceId}`;
}

// Id de la pièce si le texte scanné est l'adresse d'une étiquette de l'appli.
export function extraireIdEtiquette(texte) {
  const m = String(texte || "").trim().match(/\/secretaire\/inventaire\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  return m ? m[1] : null;
}

// Un même code UPC peut sortir sur 12 chiffres (UPC-A) ou 13 (EAN-13, avec
// un 0 devant) selon le lecteur : on compare les codes numériques sans les
// zéros de tête, et les autres sans tenir compte de la casse ni des espaces.
export function normaliserCode(texte) {
  const t = String(texte || "").trim().replace(/\s+/g, "").toUpperCase();
  return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, "") : t;
}

// Retrouve la pièce correspondant à un scan parmi une liste déjà chargée.
// Retourne { piece, code, parEtiquette } — piece vaut null si rien ne
// correspond.
export function trouverPieceParScan(pieces, texte) {
  const id = extraireIdEtiquette(texte);
  if (id) return { piece: pieces.find((p) => p.id === id) || null, code: String(texte).trim(), parEtiquette: true };

  const code = normaliserCode(texte);
  const piece = code
    ? pieces.find((p) => (p.codeBarre && normaliserCode(p.codeBarre) === code) || normaliserCode(p.numero) === code) || null
    : null;
  return { piece, code: String(texte || "").trim(), parEtiquette: false };
}

// Formats d'étiquettes offerts à l'impression (géométrie :
// lib/pdfEtiquettesPieces.js).
export const FORMATS_ETIQUETTES = [
  { code: "avery-5160", label: "Feuilles Avery 5160 — imprimante de bureau", feuille: true },
  { code: "zebra-2x1", label: "Zebra — rouleau 2 × 1 po" },
  { code: "zebra-2.25x1.25", label: "Zebra — rouleau 2,25 × 1,25 po" },
  { code: "zebra-4x2", label: "Zebra — rouleau 4 × 2 po" },
];
