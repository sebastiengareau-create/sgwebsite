const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const NOIR = "#000000";
const POUCE = 72; // points PDF par pouce

// Géométrie des formats offerts (libellés : lib/codesBarres.js). Une imprimante Zebra reçoit une page par étiquette, à la
// taille exacte du rouleau ; une imprimante de bureau reçoit des feuilles
// Avery 5160 (lettre, 3 colonnes × 10 rangées).
const FORMATS_ETIQUETTES = {
  "avery-5160": {
    feuille: {
      page: "LETTER",
      colonnes: 3, rangees: 10,
      largeur: 2.625 * POUCE, hauteur: 1 * POUCE,
      margeHaut: 0.5 * POUCE, margeGauche: 0.1875 * POUCE,
      pasH: 2.75 * POUCE, pasV: 1 * POUCE,
    },
  },
  "zebra-2x1": { largeur: 2 * POUCE, hauteur: 1 * POUCE },
  "zebra-2.25x1.25": { largeur: 2.25 * POUCE, hauteur: 1.25 * POUCE },
  "zebra-4x2": { largeur: 4 * POUCE, hauteur: 2 * POUCE },
};

// QR dessiné en carrés vectoriels : net à n'importe quelle résolution
// d'imprimante (203 ou 300 ppp pour une Zebra).
function dessinerQr(doc, texte, x, y, cote) {
  const qr = QRCode.create(texte, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const zoneCalme = 2; // modules blancs autour, en plus de la marge de l'étiquette
  const module = cote / (n + zoneCalme * 2);
  const depart = zoneCalme * module;
  doc.fillColor(NOIR);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) doc.rect(x + depart + c * module, y + depart + r * module, module, module);
    }
  }
  doc.fill();
}

// Une étiquette : QR à gauche ; à droite, le nom de l'entreprise en
// première ligne, puis nom / numéro / emplacement de la pièce.
function dessinerEtiquette(doc, piece, x, y, largeur, hauteur, nomEntreprise) {
  const marge = Math.min(0.08 * POUCE, hauteur * 0.08);
  const coteQr = hauteur - marge * 2;
  dessinerQr(doc, piece.contenuQr, x + marge, y + marge, coteQr);

  const echelle = hauteur / POUCE; // tailles de police pensées pour 1 po de haut
  const xTexte = x + marge + coteQr + marge * 0.5;
  const largeurTexte = x + largeur - marge - xTexte;
  let yTexte = y + marge + 2 * echelle;

  const taillePolice = { entreprise: 6.5, nom: 8.5, numero: 8, emplacement: 7.5 };
  if (nomEntreprise) {
    // Réduit au besoin pour que le nom entier tienne (jusqu'à 5 pt), avant
    // de couper avec « … ».
    doc.fillColor(NOIR).font("Helvetica").fontSize(taillePolice.entreprise * echelle);
    const ajuste = taillePolice.entreprise * echelle * largeurTexte * 0.96 / doc.widthOfString(nomEntreprise);
    doc.fontSize(Math.max(5 * echelle, Math.min(taillePolice.entreprise * echelle, ajuste)));
    doc.text(nomEntreprise, xTexte, yTexte, { width: largeurTexte, height: doc.currentLineHeight(), ellipsis: true, lineBreak: false });
    yTexte += doc.currentLineHeight() + 0.5 * echelle;
    doc.lineWidth(0.5 * echelle).moveTo(xTexte, yTexte).lineTo(xTexte + largeurTexte, yTexte).stroke(NOIR);
    yTexte += 2 * echelle;
  }

  doc.fillColor(NOIR).font("Helvetica-Bold").fontSize(taillePolice.nom * echelle);
  const hauteurNom = Math.min(doc.heightOfString(piece.nom, { width: largeurTexte }), doc.currentLineHeight(true) * 2 + 1);
  doc.text(piece.nom, xTexte, yTexte, { width: largeurTexte, height: hauteurNom, ellipsis: true });
  yTexte += hauteurNom + 2 * echelle;

  doc.font("Courier-Bold").fontSize(taillePolice.numero * echelle);
  doc.text(piece.numero, xTexte, yTexte, { width: largeurTexte, height: doc.currentLineHeight(), ellipsis: true, lineBreak: false });
  yTexte += doc.currentLineHeight() + 1.5 * echelle;

  if (piece.emplacement) {
    doc.font("Helvetica").fontSize(taillePolice.emplacement * echelle);
    if (yTexte + doc.currentLineHeight() <= y + hauteur - marge) {
      doc.text(`Empl. ${piece.emplacement}`, xTexte, yTexte, { width: largeurTexte, height: doc.currentLineHeight(), ellipsis: true, lineBreak: false });
    }
  }
}

/**
 * Génère le PDF des étiquettes et retourne un Buffer.
 * pieces : [{ nom, numero, emplacement, contenuQr }], déjà répétées selon le
 * nombre de copies voulu. depart : position (1 à 30) de la première
 * étiquette sur une feuille Avery déjà entamée. nomEntreprise : première
 * ligne de chaque étiquette (omise si vide).
 */
function genererPdfEtiquettesPieces(pieces, codeFormat, depart = 1, nomEntreprise = "") {
  const format = FORMATS_ETIQUETTES[codeFormat];
  if (!format) throw new Error("FORMAT_INCONNU");

  return new Promise((resolve, reject) => {
    const feuille = format.feuille;
    const doc = feuille
      ? new PDFDocument({ size: feuille.page, margin: 0, autoFirstPage: false })
      : new PDFDocument({ size: [format.largeur, format.hauteur], margin: 0, autoFirstPage: false });
    const morceaux = [];
    doc.on("data", (chunk) => morceaux.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    if (feuille) {
      const parPage = feuille.colonnes * feuille.rangees;
      let position = Math.min(Math.max(1, Math.floor(depart) || 1), parPage) - 1;
      doc.addPage();
      for (const piece of pieces) {
        if (position >= parPage) { doc.addPage(); position = 0; }
        const colonne = position % feuille.colonnes;
        const rangee = Math.floor(position / feuille.colonnes);
        dessinerEtiquette(doc, piece, feuille.margeGauche + colonne * feuille.pasH, feuille.margeHaut + rangee * feuille.pasV, feuille.largeur, feuille.hauteur, nomEntreprise);
        position++;
      }
    } else {
      for (const piece of pieces) {
        doc.addPage();
        dessinerEtiquette(doc, piece, 0, 0, format.largeur, format.hauteur, nomEntreprise);
      }
    }

    doc.end();
  });
}

module.exports = { genererPdfEtiquettesPieces, FORMATS_ETIQUETTES };
