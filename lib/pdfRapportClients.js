const PDFDocument = require("pdfkit");

const NOIR = "#17150f";
const GRIS = "#666666";
const GRIS_CLAIR = "#999999";

const MARGE_PAGE = 50;
const LARGEUR_PAGE = 612; // LETTER
const LARGEUR_UTILE = LARGEUR_PAGE - MARGE_PAGE * 2;

const COLONNES = [
  { cle: "numero", label: "No client", largeur: 65, align: "left" },
  { cle: "nom", label: "Nom", largeur: 110, align: "left" },
  { cle: "adresse", label: "Adresse", largeur: 130, align: "left" },
  { cle: "telephone", label: "Téléphone", largeur: 80, align: "left" },
  { cle: "courriel", label: "Courriel", largeur: 127, align: "left" },
];

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
 * Génère le PDF de la liste des clients et retourne un Buffer.
 */
function genererPdfRapportClients(clients, nomEntreprise) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: MARGE_PAGE });
    const morceaux = [];
    doc.on("data", (chunk) => morceaux.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    doc.fillColor(NOIR).fontSize(18).font("Helvetica-Bold").text(nomEntreprise, MARGE_PAGE, MARGE_PAGE);
    doc.fontSize(13).font("Helvetica-Bold").fillColor(NOIR).text("Liste des clients", MARGE_PAGE, doc.y + 4);
    doc.fontSize(9).font("Helvetica").fillColor(GRIS)
      .text(`Au ${new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} — ${clients.length} client${clients.length !== 1 ? "s" : ""}`, MARGE_PAGE, doc.y + 2);
    doc.moveDown(1);

    dessinerEnTeteTableau(doc);

    doc.font("Helvetica").fontSize(9).fillColor(NOIR);
    for (const c of clients) {
      if (doc.y > 720) {
        doc.addPage();
        dessinerEnTeteTableau(doc);
        doc.font("Helvetica").fontSize(9).fillColor(NOIR);
      }

      const yLigne = doc.y;
      const valeurs = {
        numero: c.numero || "—",
        nom: c.nom,
        adresse: [c.adresse, c.ville, c.codePostal].filter(Boolean).join(", ") || "—",
        telephone: c.telephone || "—",
        courriel: c.courriel || "—",
      };
      COLONNES.forEach((col, i) => {
        doc.fillColor(NOIR).text(valeurs[col.cle], xColonne(i), yLigne, { width: col.largeur - 4, align: col.align });
      });
      doc.y = yLigne;
      doc.moveDown(1.1);
    }

    if (clients.length === 0) {
      doc.font("Helvetica-Oblique").fillColor(GRIS_CLAIR).text("Aucun client.", MARGE_PAGE, doc.y);
    }

    doc.end();
  });
}

module.exports = { genererPdfRapportClients };
