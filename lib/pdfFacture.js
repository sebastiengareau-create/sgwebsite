const PDFDocument = require("pdfkit");
const { argentPdf } = require("./format");
const fs = require("fs");
const path = require("path");
const { libelleVehicule, lignesIdentifiantsVehicule } = require("./vehicules");
const { lignesAdresse } = require("./adresse");
const { lignesEnteteEntreprise } = require("./config");
const { nomClientBon } = require("./nomClient");
const { image, CLIENT } = require("./client");
const { LIBELLE_MATERIEL_ATELIER, montantMaterielAtelier } = require("./materielAtelier");
const { montantEscompte, libelleEscompte } = require("./escompte");
const { heuresFacturablesTache, libelleContenuKit } = require("./kits");
const { separerPiecesSoumission, ligneDePieceSoumission, totauxLignesFixes } = require("./piecesSoumission");
const { lignesSoldeBon } = require("./depots");
const { nomPieceFacture } = require("./numeroPieceFacture");

const NOIR = "#17150f";
const GRIS = "#666666";
const GRIS_CLAIR = "#999999";
const ACCENT = "#c47f1f"; // version plus foncée de l'accent, plus lisible imprimée sur blanc
const FOND_CLAIR = "#f2f0ea";

function fmtHeures(h) {
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return `${heures}h${String(min).padStart(2, "0")}`;
}
// Ligne de pièce : un kit montre ce qu'il comprend
function nomLignePiece(l) {
  const nom = nomPieceFacture(l.piece.nom, l.piece.numero);
  // Retour de pièce (lib/retours.js) — sans flèche : absente des polices du PDF
  if (l.retourDeId) return `Retour : ${nom} (facture ${l.retourFacture})${l.defectueuse ? " — défectueuse" : ""}`;
  return l.kit ? `${nom} — comprend : ${libelleContenuKit(l.kit)}` : nom;
}
function fmt(montant) {
  return argentPdf(montant);
}

function cheminLogo() {
  const chemin = path.join(process.cwd(), "public", image("logo.png"));
  return fs.existsSync(chemin) ? chemin : null;
}

/**
 * En-tête commun des PDF (facture, soumission) : logo + entreprise à gauche,
 * titre, numéro, date (et statut) à droite, puis un trait.
 */
function enteteDocument(doc, infosEntreprise, { titre, numero, date, statut }) {
  const logo = cheminLogo();
  const yDepart = doc.y;
  if (logo) {
    try { doc.image(logo, 50, yDepart, { width: 46, height: 46 }); } catch { /* image illisible, on continue sans */ }
  }
  const xTexte = logo ? 106 : 50;
  doc.fillColor(NOIR).fontSize(18).font("Helvetica-Bold").text(infosEntreprise.nomEntreprise, xTexte, yDepart);
  // Adresse, ville, code postal, téléphone, courriel — un en dessous de l'autre
  doc.fontSize(9).font("Helvetica").fillColor(GRIS);
  doc.y += 2;
  for (const ligne of lignesEnteteEntreprise(infosEntreprise)) doc.text(ligne, xTexte);
  const yFinEntreprise = doc.y;

  doc.fontSize(16).font("Helvetica-Bold").fillColor(NOIR).text(titre, 350, yDepart, { width: 212, align: "right" });
  doc.fontSize(12).font("Helvetica-Bold").fillColor(ACCENT).text(`#${numero}`, 350, doc.y + 2, { width: 212, align: "right" });
  doc.fontSize(9).font("Helvetica").fillColor(GRIS)
    .text(new Date(date).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" }), 350, doc.y + 2, { width: 212, align: "right" });
  if (statut) doc.fontSize(9).font("Helvetica-Bold").fillColor(NOIR).text(statut, 350, doc.y + 2, { width: 212, align: "right" });

  doc.y = Math.max(doc.y, yFinEntreprise + 4, yDepart + 70);
  doc.moveDown(0.5);
  doc.strokeColor(NOIR).lineWidth(1.5).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
  doc.moveDown(0.8);
}

// Conditions générales en petits caractères (Administrateur → Informations de l'entreprise)
function conditionsGeneralesPdf(doc, infosEntreprise) {
  const conditions = (infosEntreprise.conditionsGenerales || "").trim();
  if (!conditions) return;
  doc.strokeColor("#dddddd").lineWidth(0.5).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(6.5).fillColor(GRIS).text(conditions, 50, doc.y, { width: 512, align: "justify", lineGap: 0.5 });
  doc.moveDown(1);
}

/**
 * Génère le PDF d'une facture émise (ou d'un aperçu, si pas encore facturée)
 * et retourne un Buffer. `bon` doit inclure client, vehicule, facture,
 * problemes (avec pieces et entreesTemps incluant employe).
 */
function genererPdfFacture(bon, infosEntreprise, dict, tpsTaux, tvqTaux) {
  return new Promise((resolve, reject) => {
    const { nomEntreprise } = infosEntreprise;
    const estFacturee = !!bon.facture;

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const morceaux = [];
    doc.on("data", (chunk) => morceaux.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    enteteDocument(doc, infosEntreprise, {
      titre: estFacturee ? "FACTURE" : "BON DE COMMANDE",
      numero: estFacturee ? bon.facture.numero : bon.numero,
      date: estFacturee ? bon.facture.dateEmission : bon.creeLe,
    });

    // ---------- Client ----------
    const yInfos = doc.y;
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("CLIENT", 50, yInfos);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(NOIR).text(nomClientBon(bon), 50, doc.y + 2);
    doc.fontSize(9.5).font("Helvetica").fillColor(GRIS);
    if (bon.client.telephone) doc.text(bon.client.telephone, 50);
    for (const ligne of lignesAdresse(bon.client)) doc.text(ligne, 50);
    const yFinClient = doc.y; // la colonne véhicule peut être plus courte
    if (bon.vehicule) {
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("VÉHICULE", 330, yInfos);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(NOIR).text(libelleVehicule(bon.vehicule) || "—", 330, yInfos + 12, { width: 232 });
      doc.fontSize(9).font("Helvetica").fillColor(GRIS);
      // Espaces fines insécables de fr-CA : absentes des polices de base du PDF
      for (const ligne of lignesIdentifiantsVehicule({ ...bon.vehicule, kilometrage: bon.kilometrage }))
        doc.text(ligne.replace(/\s/g, " "), 330, doc.y, { width: 232 });
    }

    doc.y = Math.max(doc.y, yFinClient, yInfos + 55);
    doc.moveDown(0.8);

    // ---------- Détail des travaux — colonnes description | hrs | qté | prix | total ----------
    const X_DESC = 50, L_DESC = 290;
    const X_HRS = 340, L_HRS = 50;
    const X_QTE = 390, L_QTE = 40;
    const X_PRIX = 430, L_PRIX = 60;
    const X_TOTAL = 490, L_TOTAL = 72;

    const yEntete = doc.y;
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("DÉTAIL DES TRAVAUX", X_DESC, yEntete, { width: L_DESC });
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR)
      .text("HRS", X_HRS, yEntete, { width: L_HRS, align: "right" })
      .text("QTÉ", X_QTE, yEntete, { width: L_QTE, align: "right" })
      .text("PRIX", X_PRIX, yEntete, { width: L_PRIX, align: "right" })
      .text("TOTAL", X_TOTAL, yEntete, { width: L_TOTAL, align: "right" });
    doc.y = yEntete + 11;
    doc.moveDown(0.4);

    const tauxHoraireClient = estFacturee ? bon.facture.tauxHoraireUtilise : (bon.tauxHoraireOverride ?? Number(dict.taux_horaire_client || 195));

    function ligneTravail(description, { hrs, qte, prix, total }) {
      const y = doc.y;
      doc.fontSize(9).font("Helvetica");
      // La description est la seule colonne susceptible de retourner à la
      // ligne (les autres sont des nombres courts) — on mesure sa vraie
      // hauteur pour avancer d'exactement ce qu'il faut, sinon la ligne
      // suivante retombe par-dessus un texte qui a débordé sur 2 lignes.
      const hauteurDescription = doc.heightOfString(description, { width: L_DESC });
      doc.fillColor(GRIS).text(description, X_DESC, y, { width: L_DESC });
      if (hrs) doc.fillColor(GRIS).text(hrs, X_HRS, y, { width: L_HRS, align: "right" });
      if (qte !== undefined && qte !== null) doc.fillColor(GRIS).text(String(qte), X_QTE, y, { width: L_QTE, align: "right" });
      doc.fillColor(GRIS).text(fmt(prix), X_PRIX, y, { width: L_PRIX, align: "right" });
      doc.font("Helvetica-Bold").fillColor(NOIR).text(fmt(total), X_TOTAL, y, { width: L_TOTAL, align: "right" });
      doc.y = y + Math.max(hauteurDescription, doc.currentLineHeight()) + 4;
    }

    // Pièces d'une soumission facturée : au début, avant les tâches
    const { pieces: piecesSoumission, taches: tachesAffichees } = separerPiecesSoumission(bon.problemes);
    if (piecesSoumission.length > 0) {
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(NOIR).text("Pièces", X_DESC, doc.y, { width: 380 });
      doc.moveDown(0.15);
      for (const l of piecesSoumission.map(ligneDePieceSoumission)) {
        if (doc.y > 700) doc.addPage();
        ligneTravail(nomPieceFacture(l.nom, l.numero), { qte: l.qte, prix: l.prix, total: l.total });
      }
      doc.moveDown(0.2);
    }

    tachesAffichees.forEach((pr, idx) => {
      const estMainOeuvre = (pr.categorieRevenu || "MAIN_OEUVRE") === "MAIN_OEUVRE";
      const heures = heuresFacturablesTache(pr);
      const montantManuel = !estMainOeuvre ? (pr.facturePrixUnitaire || 0) * (pr.factureQte ?? 1) : 0;

      if (doc.y > 680) doc.addPage();

      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(NOIR).text(`${idx + 1}. ${pr.description}`, X_DESC, doc.y, { width: 380 });
      if (pr.notes) {
        doc.fontSize(9).font("Helvetica-Oblique").fillColor(GRIS).text(pr.notes, X_DESC + 12, doc.y + 1, { width: 400 });
      }
      doc.moveDown(0.15);

      if (heures > 0.005) {
        ligneTravail("Main-d'œuvre", { hrs: fmtHeures(heures), prix: tauxHoraireClient, total: heures * tauxHoraireClient });
      }
      if (montantManuel > 0.005) {
        ligneTravail(pr.factureDescription || "Service", { qte: pr.factureQte ?? 1, prix: pr.facturePrixUnitaire || 0, total: montantManuel });
      }
      if (!CLIENT.piecesEnHautDuBon) {
        for (const l of pr.pieces) {
          ligneTravail(nomLignePiece(l), { qte: l.qte, prix: l.prix, total: l.qte * l.prix });
        }
      }
      doc.moveDown(0.2);
    });

    // Profil piecesEnHautDuBon : toutes les pièces du bon dans une section à part
    // (sans celles des lignes de pièces d'une soumission, déjà en haut)
    const toutesPieces = tachesAffichees.flatMap((pr) => pr.pieces);
    if (CLIENT.piecesEnHautDuBon && toutesPieces.length > 0) {
      if (doc.y > 680) doc.addPage();
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(NOIR).text("Pièces", X_DESC, doc.y, { width: 380 });
      doc.moveDown(0.15);
      for (const l of toutesPieces) {
        ligneTravail(nomLignePiece(l), { qte: l.qte, prix: l.prix, total: l.qte * l.prix });
      }
      doc.moveDown(0.2);
    }

    // Au bas des travaux : heures facturées × taux (lib/materielAtelier.js)
    const heuresMaterielAtelier = estFacturee
      ? bon.facture.heuresFacturees
      : bon.problemes.reduce((s, pr) => s + heuresFacturablesTache(pr), 0);
    const totalMaterielAtelier = estFacturee ? (bon.facture.totalMaterielAtelier || 0) : montantMaterielAtelier(heuresMaterielAtelier);
    if (totalMaterielAtelier > 0.005) {
      if (doc.y > 680) doc.addPage();
      // Même caractère que le titre « Pièces » ; le montant seul, sans les
      // heures ni le taux
      const yMateriel = doc.y;
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(NOIR).text(LIBELLE_MATERIEL_ATELIER, X_DESC, yMateriel, { width: 380 });
      doc.fontSize(9).font("Helvetica-Bold").fillColor(NOIR).text(fmt(totalMaterielAtelier), X_TOTAL, yMateriel + 1, { width: L_TOTAL, align: "right" });
      doc.y = yMateriel + 14;
      doc.moveDown(0.2);
    }

    doc.moveDown(0.3);
    doc.strokeColor("#dddddd").lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.6);

    // ---------- Totaux ----------
    const totalPieces = estFacturee
      ? bon.facture.totalPieces
      : totauxLignesFixes(bon.problemes).pieces + bon.problemes.reduce((s, pr) => s + pr.pieces.reduce((s2, l) => s2 + l.qte * l.prix, 0), 0);
    const totalHeures = estFacturee
      ? bon.facture.heuresFacturees
      : bon.problemes.reduce((s, pr) => s + heuresFacturablesTache(pr), 0);
    const totalMainOeuvre = estFacturee ? bon.facture.totalMainOeuvre : totalHeures * tauxHoraireClient;
    const totalAutresRevenus = estFacturee
      ? (bon.facture.totalAutresRevenus || 0)
      : totauxLignesFixes(bon.problemes).autres;
    const sousTotalAvantEscompte = estFacturee ? bon.facture.totalFacture + (bon.facture.escompteApplique || 0) : totalPieces + totalMainOeuvre + totalAutresRevenus + totalMaterielAtelier;
    const escompteApplique = estFacturee ? (bon.facture.escompteApplique || 0) : montantEscompte(bon, sousTotalAvantEscompte);
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

    function ligneTaxe(label, numero, valeur) {
      doc.font("Helvetica").fontSize(9.5).fillColor(GRIS);
      const yLigne = doc.y;
      doc.text(label, 350, yLigne, { lineBreak: false });
      const xNumero = 350 + doc.widthOfString(label) + 6;
      if (numero) doc.fontSize(7).fillColor(GRIS_CLAIR).text(`n° ${numero}`, xNumero, yLigne + 2, { lineBreak: false });
      doc.fontSize(9.5).fillColor(GRIS).text(fmt(valeur), 480, yLigne, { width: 82, align: "right" });
      doc.y = yLigne;
      doc.moveDown(0.35);
      doc.y = Math.max(doc.y, yLigne + 13);
    }

    ligne("Main-d'œuvre", totalMainOeuvre, { petit: true });
    if (totalAutresRevenus > 0) ligne("Autres services", totalAutresRevenus, { petit: true });
    ligne("Pièces", totalPieces, { petit: true });
    if (totalMaterielAtelier > 0) ligne(LIBELLE_MATERIEL_ATELIER, totalMaterielAtelier, { petit: true });
    doc.strokeColor("#dddddd").moveTo(350, doc.y + 2).lineTo(562, doc.y + 2).stroke();
    doc.moveDown(0.25);
    ligne("Sous-total", sousTotalAvantEscompte, { gras: escompteApplique === 0 });
    if (escompteApplique > 0) {
      ligne(libelleEscompte(bon), -escompteApplique, { petit: true });
      ligne("Sous-total après escompte", totalFacture, { gras: true });
    }
    // Taxes : numéro d'inscription de l'entreprise juste à côté du montant
    ligneTaxe(`TPS (${tpsTaux}%)`, dict.tps_numero, tpsMontant);
    ligneTaxe(`TVQ (${tvqTaux}%)`, dict.tvq_numero, tvqMontant);

    doc.strokeColor(NOIR).lineWidth(1.5).moveTo(350, doc.y + 3).lineTo(562, doc.y + 3).stroke();
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NOIR).text(`TOTAL ${estFacturee ? "" : "ESTIMÉ "}(taxes incl.)`, 350, doc.y, { width: 140 });
    doc.font("Helvetica-Bold").fontSize(17).fillColor(ACCENT).text(fmt(totalAvecTaxes), 350, doc.y - 14, { width: 212, align: "right" });
    // Dépôt et paiements déjà reçus (lib/depots.js, lib/paiementsFactures.js) : le solde
    const lignesSolde = lignesSoldeBon(bon, totalAvecTaxes);
    if (lignesSolde.length > 0) {
      doc.moveDown(0.6);
      for (const l of lignesSolde) ligne(l.label, l.valeur, { petit: l.petit, gras: l.gras });
    }

    doc.moveDown(2);
    conditionsGeneralesPdf(doc, infosEntreprise);
    if (CLIENT.signatureFacture) {
      // Profil signatureFacture : une ligne pour signer au lieu de la mention
      doc.moveDown(1.5);
      if (doc.y > 700) doc.addPage();
      const ySignature = doc.y;
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(NOIR).text("Signature :", 50, ySignature);
      doc.strokeColor(NOIR).lineWidth(1).moveTo(118, ySignature + 11).lineTo(400, ySignature + 11).stroke();
    } else {
      doc.fontSize(8.5).fillColor(GRIS_CLAIR).font("Helvetica")
        .text(`${nomEntreprise} — document généré le ${new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}`, 50, doc.y, { width: 512, align: "center" });
    }

    doc.end();
  });
}

module.exports = { genererPdfFacture, enteteDocument, conditionsGeneralesPdf, NOIR, GRIS, GRIS_CLAIR, ACCENT, fmt };
