// Étiquettes d'un jeu de pneus entreposé (module Entreposage de pneus,
// lib/pneus.js) : une par pneu, avec un QR vers la fiche du jeu
// (/pneus/<id>), le client, le véhicule, les pneus et l'emplacement. Même
// mise en page que les étiquettes de l'élevage (lib/pdfEtiquettesElevage.js).
const { genererPdfEtiquettes } = require("./pdfEtiquettesPieces");
const { dessinerEtiquetteQr } = require("./pdfEtiquettesElevage");

// etiquettes : [{ contenuQr, entete, titre, details, pied }] → PDF (Buffer)
function genererPdfEtiquettesPneus(etiquettes, codeFormat, depart = 1) {
  return genererPdfEtiquettes(etiquettes, codeFormat, depart, dessinerEtiquetteQr);
}

module.exports = { genererPdfEtiquettesPneus };
