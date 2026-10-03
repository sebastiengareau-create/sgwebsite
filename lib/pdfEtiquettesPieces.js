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

// Épingle de carte (icône d'emplacement), dessinée en vectoriel : les
// polices standard du PDF n'ont pas d'icônes. Tient dans un carré de côté t.
function dessinerIconeEmplacement(doc, x, y, t) {
  const cx = x + t * 0.36;
  const cy = y + t * 0.36;
  const r = t * 0.3;
  doc.save().fillColor(NOIR);
  doc.circle(cx, cy, r).fill();
  doc.polygon([cx - r * 0.82, cy + r * 0.55], [cx + r * 0.82, cy + r * 0.55], [cx, y + t * 0.98]).fill();
  doc.fillColor("#ffffff").circle(cx, cy, r * 0.42).fill();
  doc.restore();
}

// Une étiquette : QR à gauche ; à droite, un en-tête (nom de l'entreprise
// et logo dans le coin supérieur droit), puis nom / numéro / emplacement de
// la pièce.
function dessinerEtiquette(doc, piece, x, y, largeur, hauteur, { nomEntreprise, logo } = {}) {
  const marge = Math.min(0.08 * POUCE, hauteur * 0.08);
  const coteQr = hauteur - marge * 2;
  dessinerQr(doc, piece.contenuQr, x + marge, y + marge, coteQr);

  const echelle = hauteur / POUCE; // tailles de police pensées pour 1 po de haut
  const xTexte = x + marge + coteQr + marge * 0.5;
  const largeurTexte = x + largeur - marge - xTexte;
  let yTexte = y + marge + 2 * echelle;

  // En-tête : nom de l'entreprise à gauche, logo dans le coin supérieur
  // droit, soulignés ensemble ; le nom de la pièce garde toute la largeur.
  const taillePolice = { entreprise: 6.5, nom: 8.5, numero: 8, emplacement: 7.5 };
  const yHaut = yTexte;
  let largeurEntreprise = largeurTexte;
  let basEntete = yHaut;
  if (logo) {
    const ratio = logo.width / logo.height;
    const h = Math.min(12 * echelle, (largeurTexte * 0.35) / ratio);
    const l = h * ratio;
    doc.image(logo, x + largeur - marge - l, y + marge, { width: l, height: h });
    largeurEntreprise = largeurTexte - l - 2 * echelle;
    basEntete = y + marge + h;
  }
  if (nomEntreprise) {
    // Réduit au besoin pour que le nom entier tienne sur une ligne ; s'il
    // reste trop long à côté du logo, il passe sur deux petites lignes (à
    // la hauteur du logo) ; sinon, coupé avec « … » à 5 pt.
    doc.fillColor(NOIR).font("Helvetica").fontSize(taillePolice.entreprise * echelle);
    const ajuste = taillePolice.entreprise * echelle * largeurEntreprise * 0.96 / doc.widthOfString(nomEntreprise);
    const surDeuxLignes = logo && ajuste < 5.5 * echelle;
    doc.fontSize(surDeuxLignes ? 5.2 * echelle : Math.max(5 * echelle, Math.min(taillePolice.entreprise * echelle, ajuste)));
    const hauteurBloc = surDeuxLignes
      ? Math.min(doc.heightOfString(nomEntreprise, { width: largeurEntreprise }), doc.currentLineHeight(true) * 2)
      : doc.currentLineHeight();
    // Aligné sur le bas du logo, juste au-dessus du trait
    const yNom = Math.max(yHaut, basEntete - hauteurBloc);
    doc.text(nomEntreprise, xTexte, yNom, { width: largeurEntreprise, height: hauteurBloc + 1, ellipsis: true, lineBreak: surDeuxLignes });
    basEntete = Math.max(basEntete, yNom + hauteurBloc);
  }
  if (logo || nomEntreprise) {
    yTexte = basEntete + 0.5 * echelle;
    doc.lineWidth(0.5 * echelle).moveTo(xTexte, yTexte).lineTo(xTexte + largeurTexte, yTexte).stroke(NOIR);
    yTexte += 2 * echelle;
  }

  doc.fillColor(NOIR).font("Helvetica-Bold").fontSize(taillePolice.nom * echelle);
  const hauteurNom = Math.min(doc.heightOfString(piece.nom, { width: largeurTexte }), doc.currentLineHeight(true) * 2 + 1);
  // +1 : pdfkit écarte une ligne dont le bas tombe pile sur la limite
  // (arrondi), ce qui ferait perdre la 2e ligne du nom.
  doc.text(piece.nom, xTexte, yTexte, { width: largeurTexte, height: hauteurNom + 1, ellipsis: true });
  yTexte += hauteurNom + 2 * echelle;

  doc.font("Courier-Bold").fontSize(taillePolice.numero * echelle);
  doc.text(piece.numero, xTexte, yTexte, { width: largeurTexte, height: doc.currentLineHeight(), ellipsis: true, lineBreak: false });
  yTexte += doc.currentLineHeight() + 1.5 * echelle;

  if (piece.emplacement) {
    doc.font("Helvetica").fontSize(taillePolice.emplacement * echelle);
    const ligne = doc.currentLineHeight();
    if (yTexte + ligne <= y + hauteur - marge) {
      const icone = ligne * 0.95;
      dessinerIconeEmplacement(doc, xTexte, yTexte - ligne * 0.05, icone);
      doc.fillColor(NOIR).text(piece.emplacement, xTexte + icone * 0.85, yTexte, { width: largeurTexte - icone * 0.85, height: ligne, ellipsis: true, lineBreak: false });
    }
  }
}

/**
 * Génère le PDF des étiquettes et retourne un Buffer.
 * pieces : [{ nom, numero, emplacement, contenuQr }], déjà répétées selon le
 * nombre de copies voulu. depart : position (1 à 30) de la première
 * étiquette sur une feuille Avery déjà entamée. entete : { nomEntreprise,
 * logo } — nom en première ligne et logo (image PNG/JPEG, Buffer) dans le
 * coin supérieur droit, chacun omis s'il est absent.
 */
function genererPdfEtiquettesPieces(pieces, codeFormat, depart = 1, entete = {}) {
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

    // Image chargée une seule fois, réutilisée sur chaque étiquette
    const options = { nomEntreprise: entete.nomEntreprise, logo: entete.logo ? doc.openImage(entete.logo) : null };

    if (feuille) {
      const parPage = feuille.colonnes * feuille.rangees;
      let position = Math.min(Math.max(1, Math.floor(depart) || 1), parPage) - 1;
      doc.addPage();
      for (const piece of pieces) {
        if (position >= parPage) { doc.addPage(); position = 0; }
        const colonne = position % feuille.colonnes;
        const rangee = Math.floor(position / feuille.colonnes);
        dessinerEtiquette(doc, piece, feuille.margeGauche + colonne * feuille.pasH, feuille.margeHaut + rangee * feuille.pasV, feuille.largeur, feuille.hauteur, options);
        position++;
      }
    } else {
      for (const piece of pieces) {
        doc.addPage();
        dessinerEtiquette(doc, piece, 0, 0, format.largeur, format.hauteur, options);
      }
    }

    doc.end();
  });
}

module.exports = { genererPdfEtiquettesPieces, FORMATS_ETIQUETTES };
