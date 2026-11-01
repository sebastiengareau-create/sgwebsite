// Recherche permissive (clients, bons, factures…) : ni les accents, ni les
// majuscules, ni la ponctuation (trait d'union, apostrophe, point) ne
// l'empêchent de trouver. « helene » trouve « Hélène », « jean guy » trouve
// « Jean-Guy », « tremblay jean » trouve « Jean Tremblay ».

// « Hélène O'Brien-Côté » → « helene o brien cote »
function normaliserRecherche(texte) {
  return String(texte ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Mots de la recherche, normalisés (liste vide = pas de recherche)
function motsRecherche(recherche) {
  return normaliserRecherche(recherche).split(" ").filter(Boolean);
}

// Vrai si chaque mot de la recherche se trouve dans l'un des champs, dans
// n'importe quel ordre. Les champs vides sont ignorés ; une recherche vide
// correspond à tout.
function correspondRecherche(recherche, ...champs) {
  const mots = Array.isArray(recherche) ? recherche : motsRecherche(recherche);
  if (mots.length === 0) return true;
  // Chaque champ aussi sans espaces : « obrien » trouve « O'Brien »,
  // « jeanguy » trouve « Jean-Guy »
  const texte = champs.flat().filter((c) => c != null && c !== "").map((c) => {
    const n = normaliserRecherche(c);
    return n.includes(" ") ? `${n} ${n.replace(/ /g, "")}` : n;
  }).join(" | ");
  return mots.every((m) => texte.includes(m));
}

module.exports = { normaliserRecherche, motsRecherche, correspondRecherche };
