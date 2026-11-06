// Format des nombres affichés partout dans l'appli (écran et PDF) :
// espace insécable pour les milliers, virgule décimale, « $ » à la fin.
//   argent(54091.84)  → « 54 091,84 $ »
//   argent(-13440.26) → « −13 440,26 $ »
//   nombre(1234.5)    → « 1 234,50 »
// Les exports CSV gardent leur propre format (lisible par Excel).
const ESPACE = " "; // insécable : le montant ne se coupe jamais en fin de ligne

function nombre(n, decimales = 2) {
  const v = Number(n) || 0;
  const [entier, fraction] = Math.abs(v).toFixed(decimales).split(".");
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE);
  // Évite « −0,00 » pour un montant arrondi à zéro
  const negatif = v < 0 && Number(Math.abs(v).toFixed(decimales)) !== 0;
  return `${negatif ? "−" : ""}${groupes}${fraction ? "," + fraction : ""}`;
}

function argent(n, decimales = 2) {
  return `${nombre(n, decimales)}${ESPACE}$`;
}

// Les polices standard des PDF (pdfkit) n'ont pas le signe « − » : trait d'union.
function argentPdf(n, decimales = 2) {
  return argent(n, decimales).replace("−", "-");
}

module.exports = { nombre, argent, argentPdf };
