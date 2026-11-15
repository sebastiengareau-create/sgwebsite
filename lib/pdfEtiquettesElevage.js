// Étiquettes de l'élevage (module « Élevage », lib/elevage.js), sur planches
// pour imprimante ordinaire :
//  - paquet de viande : coupe, bête d'origine, génétique, persillage, date
//    d'abattage, et un QR vers la page publique de traçabilité du lot ;
//  - bête : numéro, nom, boucle, et un QR vers sa fiche (pour l'enclos).
// Mise en page commune : lib/pdfEtiquettesPieces.js.
const { genererPdfEtiquettes, dessinerQr, POUCE } = require("./pdfEtiquettesPieces");

const NOIR = "#000000";

// Texte sur lignes au plus, coupé avec « … » → hauteur prise
function ecrire(doc, texte, x, y, largeur, lignes = 1) {
  const hauteur = Math.min(doc.heightOfString(texte, { width: largeur }), doc.currentLineHeight(true) * lignes) + 1;
  doc.text(texte, x, y, { width: largeur, height: hauteur, ellipsis: true });
  return hauteur - 1;
}

// QR à gauche (carré de la hauteur de l'étiquette, sans dépasser 40 % de sa
// largeur) ; à droite : petite ligne d'en-tête soulignée, titre en gras,
// lignes de détail, et une dernière ligne ancrée en bas.
function dessiner(doc, e, x, y, largeur, hauteur) {
  const marge = Math.min(0.1 * POUCE, hauteur * 0.08);
  const coteQr = Math.min(hauteur - marge * 2, largeur * 0.4);
  dessinerQr(doc, e.contenuQr, x + marge, y + (hauteur - coteQr) / 2, coteQr);

  // Tailles pensées pour 1 po de haut ; une étiquette plus grande grossit
  // le texte, sans excès
  const echelle = Math.min(hauteur / POUCE, 1.5);
  const xTexte = x + marge + coteQr + marge * 0.6;
  const largeurTexte = x + largeur - marge - xTexte;
  const bas = y + hauteur - marge;
  let yTexte = y + marge + 1 * echelle;
  doc.fillColor(NOIR);

  if (e.entete) {
    doc.font("Helvetica").fontSize(6.5 * echelle);
    yTexte += ecrire(doc, e.entete, xTexte, yTexte, largeurTexte) + 0.5 * echelle;
    doc.lineWidth(0.5 * echelle).moveTo(xTexte, yTexte).lineTo(xTexte + largeurTexte, yTexte).stroke(NOIR);
    yTexte += 2 * echelle;
  }

  doc.font("Helvetica").fontSize(7 * echelle);
  const ligne = doc.currentLineHeight(true);
  const details = (e.details || []).filter(Boolean);
  const yPied = e.pied ? bas - ligne : bas;
  // Le titre prend deux lignes s'il reste la place au-dessus des détails
  doc.font("Helvetica-Bold").fontSize(9.5 * echelle);
  const placeTitre = yPied - details.length * ligne - yTexte - 1.5 * echelle;
  yTexte += ecrire(doc, e.titre, xTexte, yTexte, largeurTexte, placeTitre >= doc.currentLineHeight(true) * 2 ? 2 : 1) + 1.5 * echelle;

  doc.font("Helvetica").fontSize(7 * echelle);
  for (const detail of details) {
    if (yTexte + ligne > yPied + 0.5) break;
    yTexte += ecrire(doc, detail, xTexte, yTexte, largeurTexte);
  }
  if (e.pied) doc.font("Helvetica-Bold").fontSize(7 * echelle).text(e.pied, xTexte, yPied, { width: largeurTexte, height: ligne + 1, ellipsis: true, lineBreak: false });
}

/**
 * etiquettes : [{ contenuQr, entete, titre, details: [..], pied }], déjà
 * répétées selon le nombre de copies → PDF (Buffer)
 */
function genererPdfEtiquettesElevage(etiquettes, codeFormat, depart = 1) {
  return genererPdfEtiquettes(etiquettes, codeFormat, depart, dessiner);
}

module.exports = { genererPdfEtiquettesElevage };
