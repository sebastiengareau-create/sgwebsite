// Copies T4 à remettre aux employés (avant la fin de février), en PDF :
// deux copies par feuille comme le suggère l'ARC, et au verso la
// description des cases. Version personnalisée du feuillet T4, qui n'a pas
// besoin d'approbation de l'ARC (circulaire IC97-2) tant qu'elle ressemble
// au feuillet officiel : cases numérotées, « Protégé B une fois rempli »,
// avis de confidentialité. Le numéro de compte de l'employeur (case 54)
// n'est pas imprimé sur les copies de l'employé (consigne de l'ARC).
import PDFDocument from "pdfkit";
import { formaterNas } from "./nas";
import { nomsEmploye } from "./nomsFeuillets";
import { casesT4 } from "./finAnnee";

const NOIR = "#111111";
const GRIS = "#555555";
const TRAIT = "#333333";
const MARGE = 20;
const LARGEUR = 612 - 2 * MARGE;
const HAUTEUR_COPIE = 368;
const texte = (t) => String(t ?? "").replace(/−/g, "-");
const argent = (n) => (Number(n) > 0 ? Number(n).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, " ") : "");

// Cases du recto, dans l'ordre du feuillet officiel (deux colonnes)
const CASES_MONTANTS = [
  ["14", "Revenus d'emploi", "Employment income", "empt_incamt"],
  ["22", "Impôt sur le revenu retenu", "Income tax deducted", "itx_ddct_amt"],
  ["16", "Cotisations de l'employé au RPC", "Employee's CPP contributions", null],
  ["24", "Gains assurables d'AE", "EI insurable earnings", "ei_insu_ern_amt"],
  ["16A", "Deuxièmes cotisations au RPC", "Employee's second CPP contributions", null],
  ["26", "Gains ouvrant droit à pension – RPC/RRQ", "CPP/QPP pensionable earnings", "cpp_qpp_ern_amt"],
  ["17", "Cotisations de l'employé au RRQ", "Employee's QPP contributions", "qpp_cntrb_amt"],
  ["44", "Cotisations syndicales", "Union dues", null],
  ["17A", "Deuxièmes cotisations au RRQ", "Employee's second QPP contributions", "qppe_cntrb_amt"],
  ["46", "Dons de bienfaisance", "Charitable donations", null],
  ["18", "Cotisations de l'employé à l'AE", "Employee's EI premiums", "empe_eip_amt"],
  ["50", "N° d'agrément du RPA ou du RPDB", "RPP or DPSP registration number", null],
  ["20", "Cotisations à un RPA", "RPP contributions", null],
  ["52", "Facteur d'équivalence", "Pension adjustment", null],
  ["55", "Cotisations de l'employé au RPAP", "Employee's PPIP premiums", "prov_pip_amt"],
  ["56", "Gains assurables du RPAP", "PPIP insurable earnings", "prov_insu_ern_amt"],
];

// Petit drapeau du Canada (symbole du gouvernement du Canada)
function drapeau(doc, x, y, h) {
  const w = h * 2;
  doc.save();
  doc.rect(x, y, w, h).fill("#ffffff");
  doc.rect(x, y, w / 4, h).fill("#d52b1e");
  doc.rect(x + (3 * w) / 4, y, w / 4, h).fill("#d52b1e");
  const cx = x + w / 2;
  const s = h / 10;
  // Feuille d'érable stylisée
  const pts = [[0, -4], [0.8, -2.6], [1.8, -3], [1.4, -1], [3, -1.8], [2.6, -0.8], [3.4, -0.4], [1.6, 1], [1.8, 1.8], [0.2, 1.4], [0.2, 3.4], [-0.2, 3.4], [-0.2, 1.4], [-1.8, 1.8], [-1.6, 1], [-3.4, -0.4], [-2.6, -0.8], [-3, -1.8], [-1.4, -1], [-1.8, -3], [-0.8, -2.6]];
  doc.polygon(...pts.map(([px, py]) => [cx + px * s, y + h / 2 + py * s])).fill("#d52b1e");
  doc.rect(x, y, w, h).lineWidth(0.4).stroke(TRAIT);
  doc.restore();
}

function caseVide(doc, x, y, w, h, numero, libelle, valeur, { alignDroite = true, taille = 9 } = {}) {
  doc.rect(x, y, w, h).lineWidth(0.6).stroke(TRAIT);
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(NOIR).text(numero || "", x + 2, y + 2, { width: 22, lineBreak: false });
  doc.font("Helvetica").fontSize(5.2).fillColor(GRIS).text(texte(libelle), x + (numero ? 20 : 3), y + 2, { width: w - (numero ? 23 : 6), height: 13, lineGap: -0.5 });
  if (valeur) {
    doc.font("Helvetica-Bold").fontSize(taille).fillColor(NOIR).text(texte(valeur), x + 3, y + h - taille - 3, { width: w - 6, align: alignDroite ? "right" : "left", lineBreak: false });
  }
}

function copie(doc, f, { annee, entreprise, codeDentaireDefaut, y0 }) {
  const x0 = MARGE;
  const e = f.employe;
  const noms = nomsEmploye(e);
  const c = casesT4(f);

  // En-tête
  drapeau(doc, x0, y0 + 2, 10);
  doc.font("Helvetica").fontSize(6).fillColor(NOIR).text("Agence du revenu du Canada", x0 + 24, y0 + 1).text("Canada Revenue Agency", x0 + 24, y0 + 8);
  doc.font("Helvetica-Bold").fontSize(20).text("T4", x0 + 170, y0 - 2, { width: 50 });
  doc.font("Helvetica-Bold").fontSize(8).text("État de la rémunération payée", x0 + 205, y0 + 1, { width: 200 });
  doc.font("Helvetica").fontSize(7.5).text("Statement of Remuneration Paid", x0 + 205, y0 + 11, { width: 200 });
  caseVide(doc, x0 + LARGEUR - 70, y0 - 2, 70, 24, "", "Année / Year", String(annee), { alignDroite: false, taille: 11 });
  doc.font("Helvetica").fontSize(6).fillColor(GRIS).text("Protégé B une fois rempli / Protected B when completed", x0 + LARGEUR - 230, y0 + 24, { width: 230, align: "right" });

  // Colonne de gauche : employeur, identification, employé
  const yG = y0 + 34;
  const wG = 250;
  doc.rect(x0, yG, wG, 52).lineWidth(0.6).stroke(TRAIT);
  doc.font("Helvetica").fontSize(5.2).fillColor(GRIS).text("Nom de l'employeur – Employer's name", x0 + 3, yG + 2);
  const adresseEmployeur = [entreprise.adresseLigne1, [entreprise.ville, entreprise.province, entreprise.codePostal].filter(Boolean).join(" ")].filter(Boolean);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NOIR).text(texte(entreprise.nomEntreprise), x0 + 4, yG + 11, { width: wG - 8, lineBreak: false });
  doc.font("Helvetica").fontSize(7.5).text(texte(adresseEmployeur.join("\n")), x0 + 4, yG + 23, { width: wG - 8 });

  const yI = yG + 56;
  caseVide(doc, x0, yI, 125, 26, "54", "Numéro de compte de l'employeur – Employer's account number", "");
  caseVide(doc, x0 + 129, yI, 121, 26, "10", "Province d'emploi – Province of employment", "QC", { alignDroite: false });
  caseVide(doc, x0, yI + 30, 125, 26, "12", "Numéro d'assurance sociale – Social insurance number", formaterNas(e.nas), { alignDroite: false });
  caseVide(doc, x0 + 129, yI + 30, 121, 26, "29", "Code d'emploi – Employment code", "", { alignDroite: false });
  const exempt = [
    ["RPC/RRQ", e.exemptionRRQ || c.qpp_cntrb_amt === 0],
    ["AE / EI", e.exemptionAE || c.empe_eip_amt === 0],
    ["RPAP / PPIP", c.prov_pip_amt === 0],
  ];
  caseVide(doc, x0, yI + 60, 170, 26, "28", "Exemption – Exempt (cochée = exempté)", "");
  exempt.forEach(([libelle, coche], i) => {
    const xx = x0 + 22 + i * 50;
    doc.rect(xx, yI + 75, 7, 7).lineWidth(0.5).stroke(TRAIT);
    if (coche) doc.font("Helvetica-Bold").fontSize(7).fillColor(NOIR).text("X", xx + 1.3, yI + 75.5, { lineBreak: false });
    doc.font("Helvetica").fontSize(5.5).fillColor(NOIR).text(libelle, xx + 9, yI + 76.5, { lineBreak: false });
  });
  caseVide(doc, x0 + 174, yI + 60, 76, 26, "45", "Prestations dentaires – Dental benefits", String(e.codeDentaireT4 || codeDentaireDefaut), { alignDroite: false });

  const yE = yI + 90;
  doc.rect(x0, yE, wG, 96).lineWidth(0.6).stroke(TRAIT);
  doc.font("Helvetica").fontSize(5.2).fillColor(GRIS)
    .text("Nom et adresse de l'employé – Employee's name and address", x0 + 3, yE + 2)
    .text("Nom de famille – Last name", x0 + 3, yE + 11)
    .text("Prénom – First name", x0 + 140, yE + 11);
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(NOIR)
    .text(texte(noms.nomFamille), x0 + 4, yE + 19, { width: 130, lineBreak: false })
    .text(texte(noms.prenom), x0 + 141, yE + 19, { width: 105, lineBreak: false });
  const adresseEmploye = [e.adresse, [e.ville, e.province, e.codePostal].filter(Boolean).join(" ")].filter(Boolean);
  doc.font("Helvetica").fontSize(8.5).text(texte(adresseEmploye.join("\n")), x0 + 4, yE + 36, { width: wG - 8 });
  if (e.numeroEmploye) doc.font("Helvetica").fontSize(6.5).fillColor(GRIS).text(`No d'employé : ${texte(e.numeroEmploye)}`, x0 + 4, yE + 84, { lineBreak: false });

  // Colonne de droite : montants
  const xD = x0 + wG + 8;
  const wCase = (LARGEUR - wG - 8 - 4) / 2;
  CASES_MONTANTS.forEach(([numero, fr, en, cle], i) => {
    const col = i % 2;
    const ligne = Math.floor(i / 2);
    const valeur = cle ? (cle === "ei_insu_ern_amt" || cle === "cpp_qpp_ern_amt" || cle === "empt_incamt" ? argent(c[cle]) || "0,00" : argent(c[cle])) : "";
    caseVide(doc, xD + col * (wCase + 4), yG + ligne * 30, wCase, 26, numero, `${fr} – ${en}`, valeur);
  });
  const yAutres = yG + 8 * 30;
  doc.font("Helvetica").fontSize(5.2).fillColor(GRIS).text("Autres renseignements – Other information (voir au verso – see over)", xD, yAutres);
  for (let i = 0; i < 3; i++) {
    const xx = xD + i * ((LARGEUR - wG - 8) / 3);
    const w = (LARGEUR - wG - 8) / 3 - 4;
    caseVide(doc, xx, yAutres + 8, 28, 22, "", "Case – Box", "");
    caseVide(doc, xx + 30, yAutres + 8, w - 30, 22, "", "Montant – Amount", "");
  }

  doc.font("Helvetica-Bold").fontSize(7).fillColor(NOIR).text("Copie de l'employé – Employee's copy", x0, y0 + HAUTEUR_COPIE - 26, { lineBreak: false });
  doc.font("Helvetica").fontSize(6).fillColor(GRIS).text("Voir au verso la description des cases et l'avis de confidentialité. – See the back for box descriptions and the privacy notice.", x0, y0 + HAUTEUR_COPIE - 17, { width: LARGEUR, lineBreak: false });
}

const DESCRIPTIONS = [
  ["10", "Province d'emploi. QC : Québec."],
  ["12", "Votre numéro d'assurance sociale."],
  ["14", "Revenus d'emploi : salaire, vacances payées, primes et indemnités de jours fériés, avant retenues. Reportez ce montant à la ligne 10100 de votre déclaration fédérale."],
  ["17, 17A", "Cotisations au Régime de rentes du Québec retenues (base et première cotisation supplémentaire ; deuxième cotisation supplémentaire)."],
  ["18", "Cotisations à l'assurance-emploi retenues."],
  ["22", "Impôt fédéral sur le revenu retenu. L'impôt du Québec retenu figure sur votre relevé 1."],
  ["24", "Gains assurables d'assurance-emploi (jusqu'au maximum de l'année)."],
  ["26", "Gains ouvrant droit à pension au RRQ (jusqu'au maximum de l'année)."],
  ["28", "Case cochée : vous n'avez pas cotisé (RRQ, AE ou RPAP) pendant l'année."],
  ["45", "Accès à des soins dentaires offerts par l'employeur : 1 aucun ; 2 employé seulement ; 3 employé, conjoint et enfants ; 4 employé et conjoint ; 5 employé et enfants."],
  ["55, 56", "Cotisations au Régime québécois d'assurance parentale retenues, et salaire assurable du RPAP."],
  ["54", "Numéro de compte de l'employeur : il n'est pas imprimé sur les copies de l'employé."],
];
const CONFIDENTIALITE = "Les renseignements personnels, y compris le numéro d'assurance sociale, sont recueillis en vertu de la Loi de l'impôt sur le revenu pour l'administration de l'impôt et des programmes connexes. Selon la Loi sur la protection des renseignements personnels, vous avez le droit d'accéder à vos renseignements personnels, de les faire corriger et de porter plainte au Commissaire à la protection de la vie privée du Canada. Personal information, including the social insurance number, is collected under the Income Tax Act to administer tax and related programs. Under the Privacy Act, you have the right to access and correct your personal information and to file a complaint with the Privacy Commissioner of Canada.";

function verso(doc, y0, annee) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NOIR).text(`T4 ${annee} — Description des cases (Box descriptions)`, MARGE, y0);
  let y = y0 + 16;
  for (const [cases, description] of DESCRIPTIONS) {
    doc.font("Helvetica-Bold").fontSize(7).fillColor(NOIR).text(`Case ${cases}`, MARGE, y, { width: 50 });
    doc.font("Helvetica").fontSize(7).text(texte(description), MARGE + 52, y, { width: LARGEUR - 52 });
    y = doc.y + 3;
  }
  doc.font("Helvetica").fontSize(6).fillColor(GRIS).text("Conservez cette copie avec vos dossiers. Vous pouvez aussi consulter vos feuillets dans Mon dossier de l'ARC.", MARGE, y + 4, { width: LARGEUR });
  doc.font("Helvetica").fontSize(5.6).text(CONFIDENTIALITE, MARGE, doc.y + 4, { width: LARGEUR, lineGap: -0.5 });
}

// PDF des copies T4 : pour chaque employé, une feuille avec deux copies
// (recto) puis la description des cases (verso, à imprimer recto verso)
export async function pdfCopiesT4({ annee, feuillets, entreprise, codeDentaireDefaut = 1 }) {
  const doc = new PDFDocument({ size: "LETTER", margin: 0, info: { Title: `T4 ${annee} — copies des employés`, Producer: "kontrolshop" } });
  const morceaux = [];
  const fin = new Promise((resolve) => {
    doc.on("data", (m) => morceaux.push(m));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
  });
  feuillets.forEach((f, i) => {
    if (i > 0) doc.addPage();
    copie(doc, f, { annee, entreprise, codeDentaireDefaut, y0: MARGE + 4 });
    doc.save().moveTo(MARGE, 396).lineTo(612 - MARGE, 396).dash(3, { space: 3 }).lineWidth(0.4).stroke(GRIS).restore();
    copie(doc, f, { annee, entreprise, codeDentaireDefaut, y0: 396 + 14 });
    doc.addPage();
    verso(doc, MARGE + 4, annee);
    verso(doc, 396 + 14, annee);
  });
  doc.end();
  return fin;
}
