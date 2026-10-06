// ============================================================
// CODES-BARRES DES PIÈCES — lecture d'un scan (client et serveur)
// ============================================================
// Un scan peut donner trois choses :
//  - le QR d'une étiquette imprimée par l'appli : l'adresse de la fiche
//    (…/secretaire/inventaire/<id>), lisible aussi par l'appareil photo
//    du téléphone, sans passer par l'appli ;
//  - le code-barres du fabricant sur la boîte (UPC/EAN), noté dans le
//    champ codeBarre de la pièce ;
//  - le numéro de la pièce lui-même, un de ses autres numéros (UGS), ou
//    son numéro chez un fournisseur (code 128 sur l'emballage du
//    fournisseur, saisie).
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

// Vrai si un des autres numéros de la pièce (UGS…) contient la recherche
// (déjà en minuscules) — pour les listes de recherche par nom ou numéro.
export function autreNumeroContient(piece, q) {
  return (piece.autresNumeros || []).some((n) => n.toLowerCase().includes(q));
}

// Colonne « UGS » d'un fichier d'inventaire : des numéros séparés par des
// virgules, parmi lesquels une suite de 12 ou 13 chiffres est le code-barres
// UPC/EAN de la pièce. Retourne { numeros, codesBarres } sans doublons.
export function separerUgs(texte) {
  const numeros = [];
  const codesBarres = [];
  for (const brut of String(texte || "").split(/[,;\n]+/)) {
    const valeur = brut.trim();
    if (!valeur) continue;
    if (/^\d{12,13}$/.test(valeur.replace(/[\s-]+/g, ""))) {
      const code = valeur.replace(/[\s-]+/g, "");
      if (!codesBarres.includes(code)) codesBarres.push(code);
    } else if (!numeros.some((n) => n.toLowerCase() === valeur.toLowerCase())) {
      numeros.push(valeur);
    }
  }
  return { numeros, codesBarres };
}

// Retrouve la pièce correspondant à un scan parmi une liste déjà chargée
// (avec, si fourni, p.fournisseurs : [{ numeroFournisseur }]).
// Retourne { piece, code, parEtiquette } — piece vaut null si rien ne
// correspond.
export function trouverPieceParScan(pieces, texte) {
  const id = extraireIdEtiquette(texte);
  if (id) return { piece: pieces.find((p) => p.id === id) || null, code: String(texte).trim(), parEtiquette: true };

  const code = normaliserCode(texte);
  const piece = code
    ? pieces.find((p) => (p.codeBarre && normaliserCode(p.codeBarre) === code) || normaliserCode(p.numero) === code
      || (p.autresNumeros || []).some((n) => normaliserCode(n) === code)
      || (p.fournisseurs || []).some((f) => f.numeroFournisseur && normaliserCode(f.numeroFournisseur) === code)) || null
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
