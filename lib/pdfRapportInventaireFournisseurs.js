const PDFDocument = require("pdfkit");

const NOIR = "#17150f";
const GRIS = "#666666";
const GRIS_CLAIR = "#999999";
const ROUGE = "#a83232";
const MARGE = 50;
const LARGEUR_UTILE = 612 - MARGE * 2; // LETTER
const BAS_PAGE = 730;

const COLONNES = [
  { cle: "numero", label: "Notre no", largeur: 64, align: "left" },
  { cle: "numeroFournisseur", label: "No fourn.", largeur: 78, align: "left" },
  { cle: "nom", label: "Description", largeur: 130, align: "left" },
  { cle: "qte", label: "Qté", largeur: 30, align: "right" },
  { cle: "qteMin", label: "Min", largeur: 28, align: "right" },
  { cle: "dernierPrix", label: "Dern. prix", largeur: 58, align: "right" },
  { cle: "coutant", label: "Coût moy.", largeur: 58, align: "right" },
  { cle: "valeur", label: "Valeur", largeur: 66, align: "right" },
];

const fmt = (n) => `${n.toFixed(2)} $`;

function xColonne(i) {
  let x = MARGE;
  for (let k = 0; k < i; k++) x += COLONNES[k].largeur;
  return x;
}

function enTeteTableau(doc) {
  const y = doc.y;
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR);
  COLONNES.forEach((c, i) => doc.text(c.label.toUpperCase(), xColonne(i), y, { width: c.largeur - 4, align: c.align }));
  doc.y = y + 11;
  doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(MARGE, doc.y).lineTo(MARGE + LARGEUR_UTILE, doc.y).stroke();
  doc.y += 4;
}

function titreGroupe(doc, groupe, suite = false) {
  const nom = groupe.fournisseur ? `${groupe.fournisseur.nom}${groupe.fournisseur.actif ? "" : " (inactif)"}` : "Sans fournisseur";
  const y = doc.y;
  doc.fontSize(11.5).font("Helvetica-Bold").fillColor(NOIR).text(suite ? `${nom} (suite)` : nom, MARGE, y, { width: LARGEUR_UTILE - 80 });
  doc.fontSize(8.5).font("Helvetica").fillColor(GRIS)
    .text(`${groupe.lignes.length} pièce${groupe.lignes.length !== 1 ? "s" : ""}`, MARGE + LARGEUR_UTILE - 80, y + 2, { width: 80, align: "right" });
  doc.y = y + 16;
  doc.strokeColor(NOIR).lineWidth(0.75).moveTo(MARGE, doc.y).lineTo(MARGE + LARGEUR_UTILE, doc.y).stroke();
  doc.y += 4;
  enTeteTableau(doc);
}

/**
 * Rapport d'inventaire par fournisseur (voir construireRapportParFournisseur
 * dans lib/rapportInventaire.js). Retourne un Buffer.
 */
function genererPdfRapportInventaireFournisseurs(rapport, nomEntreprise, titreFournisseur) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: MARGE });
    const morceaux = [];
    doc.on("data", (c) => morceaux.push(c));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    doc.fillColor(NOIR).fontSize(18).font("Helvetica-Bold").text(nomEntreprise, MARGE, MARGE);
    doc.fontSize(13).text(`Inventaire par fournisseur${titreFournisseur ? ` — ${titreFournisseur}` : ""}`, MARGE, doc.y + 4);
    doc.fontSize(9).font("Helvetica").fillColor(GRIS)
      .text(`Au ${new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} — ${rapport.totalPieces} pièce${rapport.totalPieces !== 1 ? "s" : ""}`, MARGE, doc.y + 2);
    doc.moveDown(1.2);

    for (const groupe of rapport.groupes) {
      // Un groupe commence sur une nouvelle page s'il ne reste pas la place
      // de son titre et de quelques lignes.
      if (doc.y > BAS_PAGE - 80) doc.addPage();
      titreGroupe(doc, groupe);

      for (const l of groupe.lignes) {
        const valeurs = {
          numero: l.numero,
          numeroFournisseur: l.numeroFournisseur || (groupe.fournisseur ? "—" : ""),
          nom: l.habituel ? `${l.nom} *` : l.nom,
          qte: String(l.qte),
          qteMin: String(l.qteMin),
          dernierPrix: l.dernierPrix != null ? fmt(l.dernierPrix) : "—",
          coutant: fmt(l.coutant),
          valeur: fmt(l.valeur),
        };
        doc.fontSize(8.5).font("Helvetica");
        const hauteur = Math.max(...COLONNES.map((c) => doc.heightOfString(valeurs[c.cle], { width: c.largeur - 4 })));
        if (doc.y + hauteur > BAS_PAGE) {
          doc.addPage();
          titreGroupe(doc, groupe, true);
          doc.fontSize(8.5);
        }
        const y = doc.y;
        COLONNES.forEach((c, i) => {
          const sousSeuil = c.cle === "qte" && l.qte <= l.qteMin;
          doc.font(c.cle === "numeroFournisseur" || sousSeuil ? "Helvetica-Bold" : "Helvetica")
            .fillColor(sousSeuil ? ROUGE : c.cle === "qteMin" ? GRIS : NOIR)
            .text(valeurs[c.cle], xColonne(i), y, { width: c.largeur - 4, align: c.align });
        });
        doc.y = y + hauteur + 4;
      }
      if (groupe.lignes.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(GRIS_CLAIR).text("Aucune pièce liée à ce fournisseur.", MARGE, doc.y);
        doc.moveDown(0.3);
      }

      const y = doc.y + 1;
      doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(MARGE, y).lineTo(MARGE + LARGEUR_UTILE, y).stroke();
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(NOIR);
      doc.text("Sous-total", MARGE, y + 4, { width: 200 });
      doc.text(String(groupe.totalQte), xColonne(3), y + 4, { width: COLONNES[3].largeur - 4, align: "right" });
      doc.text(fmt(groupe.totalValeur), xColonne(7), y + 4, { width: COLONNES[7].largeur - 4, align: "right" });
      doc.y = y + 26;
    }

    if (rapport.groupes.length === 0) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor(GRIS_CLAIR).text("Aucune pièce en inventaire.", MARGE, doc.y);
      doc.moveDown(1);
    }

    if (doc.y > BAS_PAGE - 50) doc.addPage();
    const yTotal = doc.y;
    doc.strokeColor(NOIR).lineWidth(1).moveTo(MARGE, yTotal).lineTo(MARGE + LARGEUR_UTILE, yTotal).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(NOIR);
    doc.text(`Total (${rapport.totalPieces} pièce${rapport.totalPieces !== 1 ? "s" : ""}, ${rapport.totalQte} unités)`, MARGE, yTotal + 6, { width: 360 });
    doc.text(fmt(rapport.totalValeur), MARGE + LARGEUR_UTILE - 120, yTotal + 6, { width: 120, align: "right" });
    doc.font("Helvetica").fontSize(7.5).fillColor(GRIS).text(
      `* fournisseur habituel · Qté en rouge : au seuil minimum ou sous · Valeur = qté × coût moyen.${titreFournisseur ? "" : " Une pièce vendue par plusieurs fournisseurs paraît sous chacun ; le total, lui, la compte une seule fois."}`,
      MARGE, yTotal + 24, { width: LARGEUR_UTILE }
    );

    doc.end();
  });
}

module.exports = { genererPdfRapportInventaireFournisseurs };
