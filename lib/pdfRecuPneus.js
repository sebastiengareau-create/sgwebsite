// Reçu d'entreposage d'un jeu de pneus (module Entreposage de pneus,
// lib/pneus.js), remis ou envoyé au client au dépôt : ses pneus, leur état
// pneu par pneu (usure, code DOT, âge), l'équipement gardé avec le jeu, le
// prix de l'entreposage, les conditions (Réglages) et les signatures. Même
// en-tête que les factures et les soumissions (lib/pdfFacture.js).
const PDFDocument = require("pdfkit");
const { libelleVehicule, lignesIdentifiantsVehicule } = require("./vehicules");
const { lignesAdresse } = require("./adresse");
const { enteteDocument, NOIR, GRIS, GRIS_CLAIR, fmt } = require("./pdfFacture");

// Les polices de base du PDF n'ont pas les espaces fines de fr-CA
const net = (t) => String(t ?? "").replace(/[  ]/g, " ").replace(/[≤]/g, "<=");

/**
 * Retourne un Buffer. v : { jeu (avec client, vehicule), detail (pneusDuJeu),
 * etat (evaluerJeu), equipement (resumeEquipement), libelle (libelleJeu),
 * jantes, ages (âge de chaque pneu ou null), date (dépôt), prixSaison,
 * conditions, libellePosition }
 */
function genererPdfRecuPneus(v, infosEntreprise) {
  return new Promise((resolve, reject) => {
    const { jeu } = v;
    const doc = new PDFDocument({ size: "LETTER", margin: 50, info: { Title: `Reçu d'entreposage ${jeu.numero}` } });
    const morceaux = [];
    doc.on("data", (m) => morceaux.push(m));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    enteteDocument(doc, infosEntreprise, { titre: "REÇU D'ENTREPOSAGE", numero: jeu.numero, date: v.date, statut: net(v.libelle) });

    // ---------- Client et véhicule ----------
    const yInfos = doc.y;
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("CLIENT", 50, yInfos);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(NOIR).text(net(jeu.client.nom), 50, doc.y + 2, { width: 260 });
    doc.fontSize(9.5).font("Helvetica").fillColor(GRIS);
    if (jeu.client.telephone) doc.text(net(jeu.client.telephone), 50);
    for (const ligne of lignesAdresse(jeu.client)) doc.text(net(ligne), 50);
    const yFinClient = doc.y;
    if (jeu.vehicule) {
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("VÉHICULE", 330, yInfos);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(NOIR).text(net(libelleVehicule(jeu.vehicule)) || "—", 330, yInfos + 12, { width: 232 });
      doc.fontSize(9).font("Helvetica").fillColor(GRIS);
      for (const ligne of lignesIdentifiantsVehicule(jeu.vehicule)) doc.text(net(ligne), 330, doc.y, { width: 232 });
    }
    doc.y = Math.max(doc.y, yFinClient, yInfos + 50);
    doc.moveDown(1);

    // ---------- Les pneus ----------
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("PNEUS ENTREPOSÉS", 50, doc.y);
    doc.moveDown(0.3);
    doc.fontSize(12).font("Helvetica-Bold").fillColor(NOIR).text(net(v.libelle), 50, doc.y, { width: 512 });
    const description = [
      `${jeu.quantite} pneu${jeu.quantite > 1 ? "s" : ""}`, v.jantes, [jeu.marque, jeu.modele].filter(Boolean).join(" "),
      jeu.anneeFabrication && `fabriqués en ${jeu.anneeFabrication}`,
    ].filter(Boolean).join(" · ");
    doc.fontSize(9.5).font("Helvetica").fillColor(GRIS).text(net(description), 50, doc.y + 2, { width: 512 });
    if (jeu.emplacement) doc.text(`Emplacement à l'entrepôt : ${net(jeu.emplacement)}`, 50, doc.y + 1);
    doc.moveDown(0.8);

    // Tableau pneu par pneu
    const COL = [{ x: 50, l: 150, t: "Position" }, { x: 200, l: 90, t: "Usure (/32 po)", d: true }, { x: 290, l: 80, t: "Code DOT", d: true }, { x: 370, l: 50, t: "Âge", d: true }, { x: 430, l: 132, t: "Remarque" }];
    const yTete = doc.y;
    doc.rect(50, yTete - 3, 512, 17).fill("#f2f0ea");
    doc.fillColor(NOIR).fontSize(8.5).font("Helvetica-Bold");
    for (const c of COL) doc.text(c.t, c.x + 4, yTete + 1, { width: c.l - 8, align: c.d ? "center" : "left" });
    doc.y = yTete + 18;
    v.detail.forEach((p, i) => {
      const y = doc.y;
      const remarque = [p.remplacer && "À remplacer", p.note].filter(Boolean).join(" : ");
      const cellules = [v.libellePosition(p.position), p.usure != null ? String(p.usure).replace(".", ",") : "—", p.dot || "—", v.ages[i] != null ? `${v.ages[i]} an${v.ages[i] > 1 ? "s" : ""}` : "—", remarque];
      const hauteur = Math.max(14, doc.fontSize(9.5).font("Helvetica").heightOfString(net(remarque) || " ", { width: COL[4].l - 8 }) + 4);
      cellules.forEach((t, k) => {
        doc.font(k === 0 ? "Helvetica-Bold" : "Helvetica").fillColor(k === 4 && p.remplacer ? "#b42318" : NOIR)
          .text(net(t), COL[k].x + 4, y + 2, { width: COL[k].l - 8, align: COL[k].d ? "center" : "left" });
      });
      doc.strokeColor("#dddddd").lineWidth(0.5).moveTo(50, y + hauteur + 2).lineTo(562, y + hauteur + 2).stroke();
      doc.y = y + hauteur + 4;
    });
    doc.moveDown(0.6);

    // État au dépôt
    if (v.etat?.code) {
      const titre = { REMPLACER: "À remplacer", SURVEILLER: "À surveiller", BON: "En bon état" }[v.etat.code];
      const couleur = { REMPLACER: "#b42318", SURVEILLER: "#b54708", BON: "#067647" }[v.etat.code];
      doc.fontSize(10).font("Helvetica-Bold").fillColor(couleur).text(`État au dépôt : ${titre}`, 50, doc.y, { continued: !!v.etat.raisons.length });
      if (v.etat.raisons.length) doc.font("Helvetica").fillColor(NOIR).text(net(` — ${v.etat.raisons.join(", ").toLowerCase()}`));
      if (v.etat.code === "REMPLACER") {
        doc.fontSize(9).font("Helvetica").fillColor(GRIS).text("Nous vous recommandons de remplacer ces pneus ; demandez-nous une soumission.", 50, doc.y + 1, { width: 512 });
      }
      doc.moveDown(0.6);
    }

    // Équipement et remarques
    const lignes = [
      v.equipement.length && ["Équipement", v.equipement.join(" · ")],
      jeu.note && ["Remarques", jeu.note],
      v.prixSaison && ["Entreposage", `${fmt(v.prixSaison)} par saison, avant taxes`],
    ].filter(Boolean);
    for (const [etiquette, valeur] of lignes) {
      const y = doc.y;
      doc.fontSize(9.5).font("Helvetica-Bold").fillColor(NOIR).text(etiquette, 50, y, { width: 100 });
      doc.font("Helvetica").text(net(valeur), 150, y, { width: 412 });
      doc.y = Math.max(doc.y, y + 13);
      doc.moveDown(0.2);
    }

    // ---------- Conditions et signatures ----------
    if (doc.y > 620) doc.addPage();
    doc.moveDown(0.8);
    if (v.conditions) {
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GRIS_CLAIR).text("CONDITIONS D'ENTREPOSAGE", 50, doc.y);
      doc.moveDown(0.2);
      doc.fontSize(8).font("Helvetica").fillColor(GRIS).text(net(v.conditions), 50, doc.y, { width: 512, align: "justify", lineGap: 1 });
      doc.moveDown(1.6);
    }
    if (doc.y > 690) doc.addPage();
    const ySig = doc.y + 24;
    doc.strokeColor(NOIR).lineWidth(0.8).moveTo(50, ySig).lineTo(290, ySig).stroke().moveTo(322, ySig).lineTo(562, ySig).stroke();
    doc.fontSize(8.5).font("Helvetica").fillColor(GRIS)
      .text("Signature du client", 50, ySig + 4, { width: 240 })
      .text(`Pour ${net(infosEntreprise.nomEntreprise)}`, 322, ySig + 4, { width: 240 });
    doc.end();
  });
}

module.exports = { genererPdfRecuPneus };
