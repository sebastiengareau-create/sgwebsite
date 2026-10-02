const PDFDocument = require("pdfkit");

const NOIR = "#17150f";
const GRIS = "#666666";
const GRIS_CLAIR = "#999999";
const MARGE = 50;
const LARGEUR_UTILE = 612 - MARGE * 2; // LETTER

// Colonnes : numéro chez le fournisseur en premier — c'est celui qu'il
// cherche dans son catalogue ; notre numéro suit pour la réception.
const COLONNES = [
  { cle: "numeroFournisseur", label: "No fournisseur", largeur: 95, align: "left" },
  { cle: "numero", label: "Notre no", largeur: 80, align: "left" },
  { cle: "nom", label: "Description", largeur: 157, align: "left" },
  { cle: "qte", label: "Qté", largeur: 40, align: "right" },
  { cle: "cout", label: "Prix unit.", largeur: 60, align: "right" },
  { cle: "total", label: "Total", largeur: 80, align: "right" },
];

const fmt = (n) => `${n.toFixed(2)} $`;
const dateFr = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

function xColonne(i) {
  let x = MARGE;
  for (let k = 0; k < i; k++) x += COLONNES[k].largeur;
  return x;
}

function enTeteTableau(doc) {
  const y = doc.y;
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR);
  COLONNES.forEach((c, i) => doc.text(c.label.toUpperCase(), xColonne(i), y, { width: c.largeur - 4, align: c.align }));
  doc.moveDown(0.5);
  doc.strokeColor(NOIR).lineWidth(0.75).moveTo(MARGE, doc.y).lineTo(MARGE + LARGEUR_UTILE, doc.y).stroke();
  doc.moveDown(0.4);
}

/**
 * Bon de commande à envoyer au fournisseur. Retourne un Buffer.
 * commande : avec fournisseur et lignes (avec piece).
 */
function genererPdfCommandeFournisseur(commande, entreprise) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: MARGE });
    const morceaux = [];
    doc.on("data", (c) => morceaux.push(c));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    // Entreprise (gauche) et numéro de commande (droite)
    doc.fillColor(NOIR).fontSize(16).font("Helvetica-Bold").text(entreprise.nomEntreprise, MARGE, MARGE, { width: 300 });
    doc.fontSize(9).font("Helvetica").fillColor(GRIS);
    for (const ligne of [entreprise.adresseLigne1, entreprise.adresseLigne2, entreprise.telephone, entreprise.courriel]) {
      if (ligne) doc.text(ligne, { width: 300 });
    }
    const yBas = doc.y;
    doc.fillColor(NOIR).fontSize(15).font("Helvetica-Bold").text("BON DE COMMANDE", MARGE + 260, MARGE, { width: LARGEUR_UTILE - 260, align: "right" });
    doc.fontSize(10).font("Helvetica").text(commande.numero, { width: LARGEUR_UTILE - 260, align: "right" });
    doc.fontSize(9).fillColor(GRIS).text(`Date : ${dateFr(commande.dateEnvoi || commande.creeLe)}`, { width: LARGEUR_UTILE - 260, align: "right" });

    // Fournisseur
    doc.y = Math.max(yBas, doc.y) + 18;
    const f = commande.fournisseur;
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("FOURNISSEUR", MARGE, doc.y);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(NOIR).text(f.nom);
    doc.fontSize(9).font("Helvetica").fillColor(GRIS);
    const villeCp = [f.ville, f.codePostal].filter(Boolean).join(" ");
    for (const ligne of [f.adresse, villeCp, f.telephone, f.courriel]) {
      if (ligne) doc.text(ligne);
    }
    doc.moveDown(1.2);

    enTeteTableau(doc);
    let sousTotal = 0;
    doc.font("Helvetica").fontSize(9).fillColor(NOIR);
    for (const l of commande.lignes) {
      const total = l.qteCommandee * l.coutUnitaire;
      sousTotal += total;
      const valeurs = {
        numeroFournisseur: l.numeroFournisseur || "—", numero: l.piece.numero, nom: l.piece.nom,
        qte: String(l.qteCommandee), cout: fmt(l.coutUnitaire), total: fmt(total),
      };
      const hauteur = Math.max(...COLONNES.map((c) => doc.heightOfString(valeurs[c.cle], { width: c.largeur - 4 })));
      if (doc.y + hauteur > 720) {
        doc.addPage();
        enTeteTableau(doc);
        doc.font("Helvetica").fontSize(9).fillColor(NOIR);
      }
      const y = doc.y;
      COLONNES.forEach((c, i) => {
        doc.font(c.cle === "numeroFournisseur" ? "Helvetica-Bold" : "Helvetica")
          .text(valeurs[c.cle], xColonne(i), y, { width: c.largeur - 4, align: c.align });
      });
      doc.y = y + hauteur + 5;
    }
    if (commande.lignes.length === 0) {
      doc.font("Helvetica-Oblique").fillColor(GRIS_CLAIR).text("Aucune pièce.", MARGE, doc.y);
    }

    doc.moveDown(0.3);
    doc.strokeColor(NOIR).lineWidth(1).moveTo(MARGE, doc.y).lineTo(MARGE + LARGEUR_UTILE, doc.y).stroke();
    doc.moveDown(0.4);
    const yTotal = doc.y;
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(NOIR);
    doc.text("Sous-total estimé (avant taxes)", MARGE, yTotal, { width: xColonne(5) - MARGE - 4, align: "right" });
    doc.text(fmt(sousTotal), xColonne(5), yTotal, { width: COLONNES[5].largeur - 4, align: "right" });

    if (commande.note) {
      doc.moveDown(1.5);
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("NOTE", MARGE, doc.y);
      doc.fontSize(9.5).font("Helvetica").fillColor(NOIR).text(commande.note, MARGE, doc.y, { width: LARGEUR_UTILE });
    }

    doc.end();
  });
}

module.exports = { genererPdfCommandeFournisseur };
