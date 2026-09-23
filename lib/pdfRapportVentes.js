const PDFDocument = require("pdfkit");

const NOIR = "#17150f";
const GRIS = "#666666";
const GRIS_CLAIR = "#999999";

const MARGE_PAGE = 50;
const LARGEUR_PAGE = 612; // LETTER
const LARGEUR_UTILE = LARGEUR_PAGE - MARGE_PAGE * 2;

const COLONNES = [
  { cle: "libelle", label: "Période", largeur: 105, align: "left" },
  { cle: "nombreFactures", label: "#", largeur: 30, align: "right" },
  { cle: "totalPieces", label: "Pièces", largeur: 65, align: "right" },
  { cle: "totalMainOeuvre", label: "Main-d'œuvre", largeur: 80, align: "right" },
  { cle: "totalAvantTaxes", label: "Avant taxes", largeur: 75, align: "right" },
  { cle: "taxes", label: "Taxes", largeur: 65, align: "right" },
  { cle: "totalAvecTaxes", label: "Avec taxes", largeur: 92, align: "right" },
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

// Génère le PDF du rapport de ventes (une ligne par période) et retourne un Buffer.
function genererPdfRapportVentes({ lignes, totaux, ticketMoyen, debutStr, finStr, groupement }, nomEntreprise) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: MARGE_PAGE });
    const morceaux = [];
    doc.on("data", (chunk) => morceaux.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    doc.fillColor(NOIR).fontSize(18).font("Helvetica-Bold").text(nomEntreprise, MARGE_PAGE, MARGE_PAGE);
    doc.fontSize(13).font("Helvetica-Bold").fillColor(NOIR).text("Rapport de ventes", MARGE_PAGE, doc.y + 4);
    doc.fontSize(9).font("Helvetica").fillColor(GRIS)
      .text(`Du ${debutStr} au ${finStr} — groupé par ${groupement} — ${totaux.nombreFactures} facture${totaux.nombreFactures !== 1 ? "s" : ""}, ticket moyen ${fmt(ticketMoyen)}`, MARGE_PAGE, doc.y + 2);
    doc.moveDown(1);

    dessinerEnTeteTableau(doc);

    doc.font("Helvetica").fontSize(9).fillColor(NOIR);
    for (const l of lignes) {
      if (doc.y > 700) {
        doc.addPage();
        dessinerEnTeteTableau(doc);
        doc.font("Helvetica").fontSize(9).fillColor(NOIR);
      }

      const yLigne = doc.y;
      const valeurs = {
        libelle: l.libelle,
        nombreFactures: String(l.nombreFactures),
        totalPieces: fmt(l.totalPieces),
        totalMainOeuvre: fmt(l.totalMainOeuvre),
        totalAvantTaxes: fmt(l.totalAvantTaxes),
        taxes: fmt(l.tps + l.tvq),
        totalAvecTaxes: fmt(l.totalAvecTaxes),
      };
      COLONNES.forEach((col, i) => {
        doc.text(valeurs[col.cle], xColonne(i), yLigne, { width: col.largeur - 4, align: col.align });
      });
      doc.y = yLigne;
      doc.moveDown(1.1);
    }

    if (lignes.length === 0) {
      doc.font("Helvetica-Oblique").fillColor(GRIS_CLAIR).text("Aucune vente sur cette période.", MARGE_PAGE, doc.y);
    }

    doc.moveDown(0.3);
    doc.strokeColor(NOIR).lineWidth(1).moveTo(MARGE_PAGE, doc.y).lineTo(MARGE_PAGE + LARGEUR_UTILE, doc.y).stroke();
    doc.moveDown(0.4);

    const yTotal = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(NOIR);
    doc.text("Total", xColonne(0), yTotal, { width: COLONNES[0].largeur - 4, align: "left" });
    doc.text(String(totaux.nombreFactures), xColonne(1), yTotal, { width: COLONNES[1].largeur - 4, align: "right" });
    doc.text(fmt(totaux.totalPieces), xColonne(2), yTotal, { width: COLONNES[2].largeur - 4, align: "right" });
    doc.text(fmt(totaux.totalMainOeuvre), xColonne(3), yTotal, { width: COLONNES[3].largeur - 4, align: "right" });
    doc.text(fmt(totaux.totalAvantTaxes), xColonne(4), yTotal, { width: COLONNES[4].largeur - 4, align: "right" });
    doc.text(fmt(totaux.tps + totaux.tvq), xColonne(5), yTotal, { width: COLONNES[5].largeur - 4, align: "right" });
    doc.text(fmt(totaux.totalAvecTaxes), xColonne(6), yTotal, { width: COLONNES[6].largeur - 4, align: "right" });

    doc.end();
  });
}

module.exports = { genererPdfRapportVentes };
