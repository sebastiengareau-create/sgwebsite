// PDF d'une soumission, envoyé par courriel au client (même contenu que la
// page imprimée app/secretaire/operations/soumissions/[id]/imprimer).
const PDFDocument = require("pdfkit");
const { libelleVehicule, lignesIdentifiantsVehicule } = require("./vehicules");
const { lignesAdresse } = require("./adresse");
const { CLIENT } = require("./client");
const { enteteDocument, conditionsGeneralesPdf, NOIR, GRIS, GRIS_CLAIR, fmt } = require("./pdfFacture");

const STATUTS = { EN_ATTENTE: "En attente", ACCEPTEE: "Acceptée", FACTUREE: "Facturée", BROUILLON: "En attente", ENVOYEE: "En attente", REFUSEE: "Refusée" };

/**
 * Retourne un Buffer. `soumission` doit inclure taches (avec pieces),
 * client, vehicule et depots.
 */
function genererPdfSoumission(soumission, infosEntreprise, dict) {
  return new Promise((resolve, reject) => {
    const tauxHoraireClient = Number(dict.taux_horaire_client || 195);
    const tpsTaux = Number(dict.tps_taux || 5);
    const tvqTaux = Number(dict.tvq_taux || 9.975);

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const morceaux = [];
    doc.on("data", (chunk) => morceaux.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    enteteDocument(doc, infosEntreprise, {
      titre: "SOUMISSION",
      numero: soumission.numero,
      date: soumission.creeLe,
      statut: STATUTS[soumission.statut],
    });

    // ---------- Client et véhicule ----------
    const yInfos = doc.y;
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("CLIENT", 50, yInfos);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(NOIR).text(soumission.clientNom, 50, doc.y + 2, { width: 260 });
    doc.fontSize(9.5).font("Helvetica").fillColor(GRIS);
    if (soumission.clientTelephone) doc.text(soumission.clientTelephone, 50);
    const adresse = soumission.client || { adresse: soumission.clientAdresse, ville: soumission.clientVille, province: soumission.clientProvince, codePostal: soumission.clientCodePostal };
    for (const ligne of lignesAdresse(adresse)) doc.text(ligne, 50);
    if (soumission.client?.garantieProlongee) doc.text(`Garantie prolongée — contrat #${soumission.client.garantieProlongee}`, 50);
    const yFinClient = doc.y;

    // Véhicule du dossier choisi, ou le nouveau gardé avec la soumission
    const vehicule = soumission.vehicule || soumission.vehiculeDetails;
    if (vehicule || soumission.vehiculeInfo) {
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("VÉHICULE", 330, yInfos);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(NOIR)
        .text((vehicule ? libelleVehicule(vehicule) : soumission.vehiculeInfo) || "—", 330, yInfos + 12, { width: 232 });
      if (vehicule) {
        doc.fontSize(9).font("Helvetica").fillColor(GRIS);
        // Espaces fines insécables de fr-CA : absentes des polices de base du PDF
        for (const ligne of lignesIdentifiantsVehicule(vehicule)) doc.text(ligne.replace(/\s/g, " "), 330, doc.y, { width: 232 });
      }
    }
    doc.y = Math.max(doc.y, yFinClient, yInfos + 55);
    doc.moveDown(0.8);

    // ---------- Travaux estimés ----------
    const X_DESC = 50, L_DESC = 300;
    const X_QTE = 350, L_QTE = 50;
    const X_PRIX = 400, L_PRIX = 80;
    const X_TOTAL = 480, L_TOTAL = 82;

    function lignePiece(p) {
      if (doc.y > 700) doc.addPage();
      const y = doc.y;
      doc.fontSize(9).font("Helvetica");
      const hauteur = doc.heightOfString(p.nom, { width: L_DESC - 12 });
      doc.fillColor(GRIS).text(p.nom, X_DESC + 12, y, { width: L_DESC - 12 });
      doc.text(`${p.qte} ×`, X_QTE, y, { width: L_QTE, align: "right" });
      doc.text(fmt(p.prixEstime), X_PRIX, y, { width: L_PRIX, align: "right" });
      doc.font("Helvetica-Bold").fillColor(NOIR).text(fmt(p.qte * p.prixEstime), X_TOTAL, y, { width: L_TOTAL, align: "right" });
      doc.y = y + Math.max(hauteur, doc.currentLineHeight()) + 3;
    }

    // Profil piecesEnHautDuBon : comme sur le bon, toutes les pièces d'abord
    const piecesEnHaut = CLIENT.piecesEnHautDuBon;
    const toutesPieces = soumission.taches.flatMap((t) => t.pieces);
    if (piecesEnHaut && toutesPieces.length > 0) {
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("PIÈCES", X_DESC, doc.y);
      doc.moveDown(0.3);
      toutesPieces.forEach(lignePiece);
      doc.moveDown(0.6);
    }

    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("TRAVAUX ESTIMÉS", X_DESC, doc.y);
    doc.moveDown(0.4);
    soumission.taches.forEach((t, idx) => {
      if (doc.y > 680) doc.addPage();
      const y = doc.y;
      const hauteur = doc.fontSize(10.5).font("Helvetica-Bold").heightOfString(`${idx + 1}. ${t.description}`, { width: 300 });
      doc.fillColor(NOIR).text(`${idx + 1}. ${t.description}`, X_DESC, y, { width: 300 });
      doc.fontSize(9).font("Helvetica").fillColor(GRIS)
        .text(`${t.tempsEstime}h × ${fmt(tauxHoraireClient)} = ${fmt(t.tempsEstime * tauxHoraireClient)}`, 350, y + 1, { width: 212, align: "right" });
      doc.y = y + hauteur + 3;
      if (!piecesEnHaut) t.pieces.forEach(lignePiece);
      doc.moveDown(0.4);
    });

    // ---------- Totaux (taxes comme sur une facture) ----------
    const totalTemps = soumission.taches.reduce((s, t) => s + t.tempsEstime, 0);
    const totalMainOeuvre = totalTemps * tauxHoraireClient;
    const totalPieces = toutesPieces.reduce((s, p) => s + p.prixEstime * p.qte, 0);
    const totalEstime = totalMainOeuvre + totalPieces;
    const tpsMontant = totalEstime * (tpsTaux / 100);
    const tvqMontant = totalEstime * (tvqTaux / 100);
    const totalAvecTaxes = totalEstime + tpsMontant + tvqMontant;
    const totalDepots = (soumission.depots || []).reduce((s, d) => s + d.montant, 0);

    if (doc.y > 600) doc.addPage();
    doc.moveDown(0.3);
    doc.strokeColor(NOIR).lineWidth(1.5).moveTo(320, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.6);

    function ligne(label, valeur, { gras, petit } = {}) {
      doc.font(gras ? "Helvetica-Bold" : "Helvetica").fontSize(petit ? 9 : 9.5).fillColor(petit ? GRIS : NOIR);
      const y = doc.y;
      doc.text(label, 320, y, { width: 170 });
      doc.text(fmt(valeur), 480, y, { width: 82, align: "right" });
      doc.moveDown(0.35);
    }
    ligne(`Main-d'œuvre (${totalTemps}h × ${fmt(tauxHoraireClient)})`, totalMainOeuvre);
    ligne("Pièces estimées", totalPieces);
    ligne("Sous-total", totalEstime, { gras: true });
    ligne(`TPS (${tpsTaux}%)${dict.tps_numero ? ` n° ${dict.tps_numero}` : ""}`, tpsMontant, { petit: true });
    ligne(`TVQ (${tvqTaux}%)${dict.tvq_numero ? ` n° ${dict.tvq_numero}` : ""}`, tvqMontant, { petit: true });

    doc.strokeColor("#dddddd").lineWidth(1).moveTo(320, doc.y + 2).lineTo(562, doc.y + 2).stroke();
    doc.moveDown(0.5);
    const yTotal = doc.y;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(NOIR).text("Total estimé (taxes incl.)", 320, yTotal + 3, { width: 160 });
    doc.font("Helvetica-Bold").fontSize(15).fillColor(NOIR).text(fmt(totalAvecTaxes), 440, yTotal, { width: 122, align: "right" });
    doc.moveDown(0.5);
    if (totalDepots > 0) {
      ligne("Dépôt reçu", -totalDepots, { petit: true });
      ligne("Solde estimé", totalAvecTaxes - totalDepots, { gras: true });
    }

    doc.moveDown(2);
    doc.fontSize(8.5).font("Helvetica").fillColor(GRIS_CLAIR)
      .text(`Estimé sujet à changement selon les travaux réels requis — ${infosEntreprise.nomEntreprise}`, 50, doc.y, { width: 512, align: "center" });
    doc.moveDown(1);
    conditionsGeneralesPdf(doc, infosEntreprise);

    doc.end();
  });
}

module.exports = { genererPdfSoumission };
