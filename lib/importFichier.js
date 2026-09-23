const ExcelJS = require("exceljs");
const { Readable } = require("stream");

// Lit un fichier .xlsx/.xls/.csv uploadé (objet File du FormData) et
// retourne sa première feuille. Détecte le délimiteur CSV réel plutôt que
// de supposer une virgule — les exports Excel en français utilisent
// souvent ";" (la virgule sert de séparateur décimal dans ce format).
async function lireFeuille(fichier) {
  const octets = Buffer.from(await fichier.arrayBuffer());
  const classeur = new ExcelJS.Workbook();

  if (fichier.name?.toLowerCase().endsWith(".csv")) {
    const premiereLigne = octets.toString("utf-8").split(/\r?\n/, 1)[0] || "";
    const delimiter = (premiereLigne.match(/;/g) || []).length > (premiereLigne.match(/,/g) || []).length ? ";" : ",";
    await classeur.csv.read(Readable.from(octets), { parserOptions: { delimiter } });
  } else {
    await classeur.xlsx.load(octets);
  }

  return classeur.worksheets[0];
}

function normaliserEntete(texte) {
  return String(texte || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // retire les accents
    .toLowerCase().trim().replace(/\s+/g, " ");
}

// Associe chaque colonne de la ligne d'en-têtes à un champ connu, via une
// liste d'alias par champ (comparés sans accents/casse) — accepte les
// en-têtes tels quels dans le fichier du client (ex. "Téléphone", "Tel").
function mapperEntetes(ligneEntetes, aliasParChamp) {
  const mappage = {}; // index de colonne (1-based, ExcelJS) → nom de champ
  ligneEntetes.eachCell((cell, colNumber) => {
    const entete = normaliserEntete(cell.value);
    for (const [champ, alias] of Object.entries(aliasParChamp)) {
      if (alias.includes(entete)) {
        mappage[colNumber] = champ;
        break;
      }
    }
  });
  return mappage;
}

function valeurCellule(cell) {
  if (cell == null) return "";
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && v.text) return String(v.text).trim(); // texte enrichi
  if (typeof v === "object" && v.result !== undefined) return String(v.result).trim(); // formule
  return String(v).trim();
}

// Relit une ligne de la feuille en un objet { champ: valeurTexte } selon le
// mappage de colonnes — utilitaire commun aux différentes routes d'import.
function lireLigne(ligne, mappage) {
  const donnees = {};
  for (const [colNumber, champ] of Object.entries(mappage)) {
    donnees[champ] = valeurCellule(ligne.getCell(Number(colNumber)));
  }
  return donnees;
}

module.exports = { lireFeuille, mapperEntetes, valeurCellule, lireLigne };
