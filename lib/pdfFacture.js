const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const NOIR = "#17150f";
const GRIS = "#666666";
const GRIS_CLAIR = "#999999";
const ACCENT = "#c47f1f"; // version plus foncée de l'accent, plus lisible imprimée sur blanc
const FOND_CLAIR = "#f2f0ea";

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}
function fmtHeures(h) {
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return `${heures}h${String(min).padStart(2, "0")}`;
}
function fmt(montant) {
  return `${montant.toFixed(2)} $`;
}

function cheminLogo() {
  const chemin = path.join(process.cwd(), "public", "logo.png");
  return fs.existsSync(chemin) ? chemin : null;
}

/**
 * Génère le PDF d'une facture émise (ou d'un aperçu, si pas encore facturée)
 * et retourne un Buffer. `bon` doit inclure client, vehicule, facture,
 * problemes (avec pieces et entreesTemps incluant employe).
 */
function genererPdfFacture(bon, infosEntreprise, dict, tpsTaux, tvqTaux) {
  return new Promise((resolve, reject) => {
    const { nomEntreprise, adresseLigne1, adresseLigne2, telephone } = infosEntreprise;
    const estFacturee = !!bon.facture;

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const morceaux = [];
    doc.on("data", (chunk) => morceaux.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    // ---------- En-tête : logo + entreprise, à droite le numéro de facture ----------
    const logo = cheminLogo();
    const yDepart = doc.y;
    if (logo) {
      try { doc.image(logo, 50, yDepart, { width: 46, height: 46 }); } catch { /* image illisible, on continue sans */ }
    }
    const xTexte = logo ? 106 : 50;
    doc.fillColor(NOIR).fontSize(18).font("Helvetica-Bold").text(nomEntreprise, xTexte, yDepart);
    doc.fontSize(9).font("Helvetica").fillColor(GRIS)
      .text(`${adresseLigne1}`, xTexte, doc.y + 2)
      .text(`${adresseLigne2}`, xTexte)
      .text(`${telephone}`, xTexte);
    if (dict.tps_numero || dict.tvq_numero) {
      doc.fontSize(8).fillColor(GRIS_CLAIR);
      if (dict.tps_numero) doc.text(`TPS : ${dict.tps_numero}`, xTexte);
      if (dict.tvq_numero) doc.text(`TVQ : ${dict.tvq_numero}`, xTexte);
    }

    doc.fontSize(16).font("Helvetica-Bold").fillColor(NOIR).text(estFacturee ? "FACTURE" : "APERÇU DE FACTURE", 350, yDepart, { width: 212, align: "right" });
    doc.fontSize(12).font("Helvetica-Bold").fillColor(ACCENT)
      .text(`#${estFacturee ? bon.facture.numero : bon.numero}`, 350, doc.y + 2, { width: 212, align: "right" });
    doc.fontSize(9).font("Helvetica").fillColor(GRIS)
      .text(new Date(estFacturee ? bon.facture.dateEmission : bon.creeLe).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" }), 350, doc.y + 2, { width: 212, align: "right" });

    doc.y = Math.max(doc.y, yDepart + 70);
    doc.moveDown(0.5);
    doc.strokeColor(NOIR).lineWidth(1.5).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.8);

    // ---------- Client et véhicule, côte à côte ----------
    const yInfos = doc.y;
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("CLIENT", 50, yInfos);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(NOIR).text(bon.client.nom, 50, doc.y + 2);
    doc.fontSize(9.5).font("Helvetica").fillColor(GRIS);
    if (bon.client.telephone) doc.text(bon.client.telephone, 50);
    if (bon.client.adresse) doc.text(bon.client.adresse, 50);

    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("VÉHICULE", 320, yInfos);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(NOIR).text(`${bon.vehicule.marque} ${bon.vehicule.modele} ${bon.vehicule.annee || ""}`, 320, doc.y - (bon.client.telephone || bon.client.adresse ? 13 : 0) + 2, { width: 240 });
    doc.fontSize(9.5).font("Helvetica").fillColor(GRIS);
    if (bon.vehicule.plaque) doc.text(`Plaque : ${bon.vehicule.plaque}`, 320);

    doc.y = Math.max(doc.y, yInfos + 55);
    doc.moveDown(0.8);

    // ---------- Détail des travaux ----------
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("DÉTAIL DES TRAVAUX");
    doc.moveDown(0.4);

    const tauxHoraireClient = estFacturee ? bon.facture.tauxHoraireUtilise : Number(dict.taux_horaire_client || 195);

    bon.problemes.forEach((pr, idx) => {
      const heures = pr.entreesTemps.filter((t) => t.fin).reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);

      if (doc.y > 680) doc.addPage();

      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(NOIR).text(`${idx + 1}. ${pr.description}`, 50, doc.y, { width: 380, continued: false });
      if (heures > 0.005) {
        const montant = heures * tauxHoraireClient;
        doc.fontSize(9).font("Helvetica").fillColor(GRIS)
          .text(`${fmtHeures(heures)} × ${tauxHoraireClient.toFixed(2)} $ = ${fmt(montant)}`, 400, doc.y - 13, { width: 162, align: "right" });
      }
      doc.moveDown(0.15);

      for (const l of pr.pieces) {
        doc.fontSize(9).font("Helvetica").fillColor(GRIS).text(l.piece.nom, 60, doc.y, { width: 300 });
        doc.text(`${l.qte} × ${l.prix.toFixed(2)} $`, 400, doc.y - 11, { width: 90, align: "right" });
        doc.text(fmt(l.qte * l.prix), 480, doc.y - 11 + 0.5, { width: 82, align: "right" });
        doc.moveDown(0.1);
      }
      doc.moveDown(0.35);
    });

    doc.moveDown(0.3);
    doc.strokeColor("#dddddd").lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.6);

    // ---------- Totaux ----------
    const totalPieces = estFacturee
      ? bon.facture.totalPieces
      : bon.problemes.reduce((s, pr) => s + pr.pieces.reduce((s2, l) => s2 + l.qte * l.prix, 0), 0);
    const totalHeures = estFacturee
      ? bon.facture.heuresFacturees
      : bon.problemes.reduce((s, pr) => s + pr.entreesTemps.filter((t) => t.fin).reduce((s2, t) => s2 + dureeHeures(t.debut, t.fin), 0), 0);
    const totalMainOeuvre = estFacturee ? bon.facture.totalMainOeuvre : totalHeures * tauxHoraireClient;
    const sousTotalAvantEscompte = estFacturee ? bon.facture.totalFacture + (bon.facture.escompteApplique || 0) : totalPieces + totalMainOeuvre;
    const escompteApplique = estFacturee ? (bon.facture.escompteApplique || 0) : Math.min(bon.escompteMontant || 0, sousTotalAvantEscompte);
    const totalFacture = estFacturee ? bon.facture.totalFacture : sousTotalAvantEscompte - escompteApplique;
    const tpsMontant = estFacturee ? bon.facture.tpsMontant : totalFacture * (tpsTaux / 100);
    const tvqMontant = estFacturee ? bon.facture.tvqMontant : totalFacture * (tvqTaux / 100);
    const totalAvecTaxes = estFacturee ? bon.facture.totalAvecTaxes : totalFacture + tpsMontant + tvqMontant;

    function ligne(label, valeur, { gras, petit } = {}) {
      doc.font(gras ? "Helvetica-Bold" : "Helvetica").fontSize(gras ? 12 : 9.5).fillColor(petit ? GRIS : NOIR);
      const yLigne = doc.y;
      doc.text(label, 350, yLigne, { width: 140 });
      doc.text(fmt(valeur), 480, yLigne, { width: 82, align: "right" });
      doc.moveDown(gras ? 0.5 : 0.35);
    }

    ligne("Main-d'œuvre", totalMainOeuvre, { petit: true });
    ligne("Pièces", totalPieces, { petit: true });
    doc.strokeColor("#dddddd").moveTo(350, doc.y + 2).lineTo(562, doc.y + 2).stroke();
    doc.moveDown(0.25);
    ligne("Sous-total", sousTotalAvantEscompte, { gras: escompteApplique === 0 });
    if (escompteApplique > 0) {
      ligne(`Escompte${bon.escompteRaison ? ` (${bon.escompteRaison})` : ""}`, -escompteApplique, { petit: true });
      ligne("Sous-total après escompte", totalFacture, { gras: true });
    }
    ligne(`TPS (${tpsTaux}%)`, tpsMontant, { petit: true });
    ligne(`TVQ (${tvqTaux}%)`, tvqMontant, { petit: true });

    doc.strokeColor(NOIR).lineWidth(1.5).moveTo(350, doc.y + 3).lineTo(562, doc.y + 3).stroke();
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NOIR).text(`TOTAL ${estFacturee ? "" : "ESTIMÉ "}(taxes incl.)`, 350, doc.y, { width: 140 });
    doc.font("Helvetica-Bold").fontSize(17).fillColor(ACCENT).text(fmt(totalAvecTaxes), 350, doc.y - 14, { width: 212, align: "right" });

    doc.moveDown(2);
    doc.fontSize(8.5).fillColor(GRIS_CLAIR).font("Helvetica")
      .text(`${nomEntreprise} — document généré le ${new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}`, 50, doc.y, { width: 512, align: "center" });

    doc.end();
  });
}

module.exports = { genererPdfFacture };
