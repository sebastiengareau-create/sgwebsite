// Copie du relevé 31 à remettre aux locataires (module Immobilier) : une
// page par locataire ou sous-locataire, mise en page comme le relevé de
// Revenu Québec — année, code du relevé, cases A (numéro de logement), B
// (nombre de locataires) et C1 à C5 (adresse du logement), le locataire et
// le propriétaire. Les renseignements sont ceux de donneesReleve31
// (lib/immobilierCalculs.js), les mêmes que ceux produits dans le service en
// ligne « Produire et consulter des relevés 31 ».
//
// Ce n'est pas le formulaire officiel (RL-31 / RL-31.CS) : le document le
// dit au bas de la page. Il sert de copie au locataire et aux dossiers du
// propriétaire.

import PDFDocument from "pdfkit";
import { echeanceReleve31 } from "./immobilierCalculs";

const NOIR = "#17150f";
const GRIS = "#5f5f5f";
const FOND = "#eef1f5";
const TRAIT = "#2b2b2b";
const MARGE = 46;
const LARGEUR = 612 - MARGE * 2;

const t = (x) => String(x ?? "").replace(/−/g, "-").replace(/[–—]/g, "-");
const date = (d) => new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(d)).replace(/^1 /, "1er ");

// Case à la manière d'un formulaire : petite étiquette en haut, valeur en gras
function caseForm(doc, x, y, l, h, { lettre, titre, valeur, taille = 11, aligne = "left" }) {
  doc.lineWidth(0.7).strokeColor(TRAIT).rect(x, y, l, h).stroke();
  let gauche = x + 5;
  if (lettre) {
    doc.rect(x, y, 22, 13).fillAndStroke(NOIR, TRAIT);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#ffffff").text(lettre, x, y + 3, { width: 22, align: "center" });
    gauche = x + 27;
  }
  doc.font("Helvetica").fontSize(7).fillColor(GRIS).text(t(titre), gauche, y + 3.5, { width: x + l - gauche - 4, lineBreak: false, ellipsis: true });
  const vide = valeur === "" || valeur == null;
  const corps = vide ? 9.5 : taille;
  doc.font(vide ? "Helvetica-Oblique" : "Helvetica-Bold").fontSize(corps).fillColor(vide ? "#a23b2a" : NOIR)
    .text(vide ? "à inscrire" : t(valeur), x + 6, y + h - corps - 6, { width: l - 12, align: aligne, lineBreak: false, ellipsis: true });
}

function bandeau(doc, x, y, l, texte) {
  doc.rect(x, y, l, 15).fill(FOND);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(NOIR).text(t(texte.toUpperCase()), x + 6, y + 4, { width: l - 12, characterSpacing: 0.5 });
  return y + 15;
}

// Un relevé (une page) pour un locataire
function page(doc, { annee, rl, locataire, autres, proprietaire, copie, proprio = false }) {
  const x = MARGE;
  let y = MARGE;

  // En-tête
  doc.font("Helvetica-Bold").fontSize(18).fillColor(NOIR).text("Relevé 31", x, y);
  doc.font("Helvetica").fontSize(10.5).fillColor(NOIR).text("Renseignements sur l'occupation d'un logement", x, y + 22);
  doc.font("Helvetica").fontSize(8).fillColor(GRIS).text(t(copie), x, y + 36);
  caseForm(doc, x + LARGEUR - 200, y, 70, 34, { titre: "Année", valeur: String(annee), taille: 13, aligne: "center" });
  caseForm(doc, x + LARGEUR - 125, y, 125, 34, { titre: "Code du relevé", valeur: "R (original)", taille: 10, aligne: "center" });
  y += 54;
  doc.moveTo(x, y).lineTo(x + LARGEUR, y).lineWidth(1.5).strokeColor(NOIR).stroke();
  y += 12;

  // Cases A et B
  const h = 38;
  caseForm(doc, x, y, LARGEUR * 0.6 - 4, h, { lettre: "A", titre: "Numéro de logement (déterminé par Revenu Québec)", valeur: rl.caseA, taille: 14 });
  caseForm(doc, x + LARGEUR * 0.6 + 4, y, LARGEUR * 0.4 - 4, h, { lettre: "B", titre: "Nombre de locataires ou sous-locataires", valeur: String(rl.caseB), taille: 14, aligne: "center" });
  y += h + 12;

  // Case C : adresse du logement
  y = bandeau(doc, x, y, LARGEUR, "C - Adresse du logement au 31 décembre " + annee) + 4;
  const c1 = 90, c2 = 110;
  caseForm(doc, x, y, c1 - 4, h, { lettre: "C1", titre: "Appartement", valeur: rl.c1 || " " });
  caseForm(doc, x + c1, y, c2 - 4, h, { lettre: "C2", titre: "Numéro municipal", valeur: rl.c2 });
  caseForm(doc, x + c1 + c2, y, LARGEUR - c1 - c2, h, { lettre: "C3", titre: "Rue", valeur: rl.c3 });
  y += h + 6;
  caseForm(doc, x, y, LARGEUR * 0.55 - 4, h, { lettre: "C4", titre: "Ville ou municipalité", valeur: rl.c4 });
  caseForm(doc, x + LARGEUR * 0.55, y, LARGEUR * 0.2 - 4, h, { titre: "Province", valeur: "QC", aligne: "center" });
  caseForm(doc, x + LARGEUR * 0.75, y, LARGEUR * 0.25, h, { lettre: "C5", titre: "Code postal", valeur: rl.c5, aligne: "center" });
  y += h + 14;

  // Locataire
  y = bandeau(doc, x, y, LARGEUR, "Locataire ou sous-locataire") + 4;
  caseForm(doc, x, y, LARGEUR, h, { titre: proprio ? "Locataires ou sous-locataires du logement" : "Nom du locataire ou du sous-locataire à qui ce relevé est remis", valeur: locataire, taille: proprio ? 10 : 12 });
  y += h + 6;
  if (autres.length) {
    caseForm(doc, x, y, LARGEUR, h, { titre: "Autres locataires ou sous-locataires du logement (signataires du bail)", valeur: autres.join(", "), taille: 10 });
    y += h + 6;
  }
  y += 8;

  // Propriétaire
  y = bandeau(doc, x, y, LARGEUR, "Propriétaire de l'immeuble") + 4;
  caseForm(doc, x, y, LARGEUR, h, { titre: "Nom du propriétaire", valeur: proprietaire.nom, taille: 11 });
  y += h + 6;
  caseForm(doc, x, y, LARGEUR * 0.62 - 4, h, { titre: "Adresse", valeur: proprietaire.adresse, taille: 10 });
  caseForm(doc, x + LARGEUR * 0.62, y, LARGEUR * 0.38, h, { titre: "Téléphone", valeur: proprietaire.telephone || " ", taille: 10 });
  y += h + 18;

  // Renseignements pour le locataire
  doc.rect(x, y, LARGEUR, 1).fill(NOIR);
  y += 8;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NOIR).text("Renseignements pour le locataire", x, y);
  doc.font("Helvetica").fontSize(8.5).fillColor(NOIR).text(t(
    `Conservez ce relevé. Le numéro de logement inscrit à la case A sert à demander la composante relative au logement du crédit d'impôt pour solidarité ` +
    `(annexe D de votre déclaration de revenus du Québec, TP-1). Chaque locataire ou sous-locataire qui a signé le bail reçoit son propre relevé. ` +
    `Si un renseignement est inexact, communiquez avec votre propriétaire pour qu'il produise un relevé modifié.`
  ), x, doc.y + 3, { width: LARGEUR, lineGap: 1.5 });
  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(8.5).fillColor(GRIS).text(t(
    `Ce relevé a été produit à Revenu Québec par le propriétaire, qui doit le transmettre et en remettre une copie aux locataires au plus tard le ${date(echeanceReleve31(annee))}.`
  ), x, doc.y, { width: LARGEUR, lineGap: 1.5 });

  // Pied de page
  const bas = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font("Helvetica").fontSize(7).fillColor(GRIS).text(
    t("Copie préparée par le propriétaire, avec les mêmes renseignements que le relevé 31 produit dans le service en ligne de Revenu Québec. Ce document n'est pas le formulaire officiel RL-31."),
    MARGE, 792 - 40, { width: LARGEUR, align: "center" }
  );
  doc.page.margins.bottom = bas;
}

// releves : [{ rl (donneesReleve31), locataires: [noms] }] ; proprietaire : { nom, adresse, telephone }
// → Buffer ; une page par locataire (proprietaire: true ajoute une copie « propriétaire » par logement)
export function releves31Pdf({ annee, releves, proprietaire, copieProprietaire = false }) {
  const doc = new PDFDocument({ size: "LETTER", margin: MARGE, autoFirstPage: false, info: { Title: `Relevés 31 - ${annee}`, Producer: "Gestion immobilière" } });
  const morceaux = [];
  const fini = new Promise((resolve, reject) => {
    doc.on("data", (m) => morceaux.push(m));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);
  });
  for (const { rl } of releves) {
    const noms = rl.locataires.length ? rl.locataires : [""];
    noms.forEach((nom, i) => {
      doc.addPage();
      page(doc, { annee, rl, locataire: nom, autres: noms.filter((_, j) => j !== i && noms[j]), proprietaire, copie: `Copie du locataire${noms.length > 1 ? ` (${i + 1} de ${noms.length})` : ""}` });
    });
    if (copieProprietaire) {
      doc.addPage();
      page(doc, { annee, rl, locataire: rl.locataires.join(", "), autres: [], proprietaire, copie: "Copie du propriétaire (dossiers)", proprio: true });
    }
  }
  if (releves.length === 0) {
    doc.addPage();
    doc.font("Helvetica").fontSize(11).fillColor(NOIR).text(`Aucun logement occupé au 31 décembre ${annee}.`);
  }
  doc.end();
  return fini;
}
