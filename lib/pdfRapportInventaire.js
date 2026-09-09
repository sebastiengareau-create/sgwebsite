const PDFDocument = require("pdfkit");

const NOIR = "#17150f";
const GRIS = "#666666";
const GRIS_CLAIR = "#999999";

const MARGE_PAGE = 50;
const LARGEUR_PAGE = 612; // LETTER
const LARGEUR_UTILE = LARGEUR_PAGE - MARGE_PAGE * 2;

// Colonnes : numéro, description, qté, coûtant, vendant, marge ($ et %)
const COLONNES = [
  { cle: "numero", label: "No pièce", largeur: 75, align: "left" },
  { cle: "nom", label: "Description", largeur: 158, align: "left" },
  { cle: "qte", label: "Qté", largeur: 35, align: "right" },
  { cle: "coutant", label: "Coûtant", largeur: 58, align: "right" },
  { cle: "prix", label: "Vendant", largeur: 58, align: "right" },
  { cle: "marge", label: "Marge", largeur: 60, align: "right" },
  { cle: "margePct", label: "Marge %", largeur: 56, align: "right" },
];

function fmt(montant) {
  return `${montant.toFixed(2)} $`;
}

function xColonne(index) {
  let x = MARGE_PAGE;
  for (let i = 0; i < index; i++) x += COLONNES[i].largeur;
  return x;
}

function dessinerEnTeteTableau(doc) {
  const y = doc.y;
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR);
  COLONNES.forEach((col, i) => {
    doc.text(col.label.toUpperCase(), xColonne(i), y, { width: col.largeur - 4, align: col.align });
  });
  doc.moveDown(0.5);
  doc.strokeColor(NOIR).lineWidth(0.75).moveTo(MARGE_PAGE, doc.y).lineTo(MARGE_PAGE + LARGEUR_UTILE, doc.y).stroke();
  doc.moveDown(0.4);
}

/**
 * Génère le PDF du rapport d'inventaire (numéro, description, qté, coûtant,
 * vendant, marge) et retourne un Buffer.
 */
function genererPdfRapportInventaire(pieces, nomEntreprise) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: MARGE_PAGE });
    const morceaux = [];
    doc.on("data", (chunk) => morceaux.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    doc.fillColor(NOIR).fontSize(18).font("Helvetica-Bold").text(nomEntreprise, MARGE_PAGE, MARGE_PAGE);
    doc.fontSize(13).font("Helvetica-Bold").fillColor(NOIR).text("Rapport d'inventaire", MARGE_PAGE, doc.y + 4);
    doc.fontSize(9).font("Helvetica").fillColor(GRIS)
      .text(`Au ${new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} — ${pieces.length} pièce${pieces.length !== 1 ? "s" : ""}`, MARGE_PAGE, doc.y + 2);
    doc.moveDown(1);

    dessinerEnTeteTableau(doc);

    let totalQte = 0, totalValeurCoutant = 0, totalValeurVendant = 0, totalMarge = 0;

    doc.font("Helvetica").fontSize(9).fillColor(NOIR);
    for (const p of pieces) {
      const marge = p.prix - p.coutant;
      const margePct = p.prix > 0 ? (marge / p.prix) * 100 : 0;
      totalQte += p.qte;
      totalValeurCoutant += p.qte * p.coutant;
      totalValeurVendant += p.qte * p.prix;
      totalMarge += p.qte * marge;

      if (doc.y > 720) {
        doc.addPage();
        dessinerEnTeteTableau(doc);
        doc.font("Helvetica").fontSize(9).fillColor(NOIR);
      }

      const yLigne = doc.y;
      const valeurs = { numero: p.numero, nom: p.nom, qte: String(p.qte), coutant: fmt(p.coutant), prix: fmt(p.prix), marge: fmt(marge), margePct: `${margePct.toFixed(1)} %` };
      COLONNES.forEach((col, i) => {
        doc.fillColor((col.cle === "marge" || col.cle === "margePct") && marge < 0 ? "#a83232" : NOIR)
          .text(valeurs[col.cle], xColonne(i), yLigne, { width: col.largeur - 4, align: col.align });
      });
      doc.y = yLigne;
      doc.moveDown(1.1);
    }

    if (pieces.length === 0) {
      doc.font("Helvetica-Oblique").fillColor(GRIS_CLAIR).text("Aucune pièce en inventaire.", MARGE_PAGE, doc.y);
    }

    doc.moveDown(0.3);
    doc.strokeColor(NOIR).lineWidth(1).moveTo(MARGE_PAGE, doc.y).lineTo(MARGE_PAGE + LARGEUR_UTILE, doc.y).stroke();
    doc.moveDown(0.4);

    const totalMargePct = totalValeurVendant > 0 ? (totalMarge / totalValeurVendant) * 100 : 0;
    const yTotal = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(NOIR);
    doc.text("Total", xColonne(0), yTotal, { width: COLONNES[0].largeur - 4, align: "left" });
    doc.text(String(totalQte), xColonne(2), yTotal, { width: COLONNES[2].largeur - 4, align: "right" });
    doc.text(fmt(totalValeurCoutant), xColonne(3), yTotal, { width: COLONNES[3].largeur - 4, align: "right" });
    doc.text(fmt(totalValeurVendant), xColonne(4), yTotal, { width: COLONNES[4].largeur - 4, align: "right" });
    doc.text(fmt(totalMarge), xColonne(5), yTotal, { width: COLONNES[5].largeur - 4, align: "right" });
    doc.text(`${totalMargePct.toFixed(1)} %`, xColonne(6), yTotal, { width: COLONNES[6].largeur - 4, align: "right" });

    doc.end();
  });
}

module.exports = { genererPdfRapportInventaire };
