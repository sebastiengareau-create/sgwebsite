// Numéros de téléphone écrits partout de la même façon : (450) 555-1234.
// Utilisé par les champs des formulaires (à la sortie du champ) et à
// l'enregistrement (lib/prisma.js), donc aucune dépendance serveur ici.
//
// 10 chiffres, ou 11 commençant par 1 (indicatif nord-américain) →
// (xxx) xxx-xxxx. Un poste à la fin est gardé : « 450 555 1234 poste 12 »
// → « (450) 555-1234 poste 12 ». Tout le reste (numéro étranger,
// incomplet…) reste tel qu'écrit.
function formaterTelephone(valeur) {
  if (typeof valeur !== "string") return valeur;
  const texte = valeur.trim();
  const m = texte.match(/^(?:\+?1[\s.-]*)?\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})(?:\s*(?:,|;)?\s*((?:poste|post\.?|ext\.?|x|#)\s*\d+))?$/i);
  if (!m) return texte;
  const principal = `(${m[1]}) ${m[2]}-${m[3]}`;
  return m[4] ? `${principal} ${m[4].replace(/^(poste|post\.?|ext\.?|x|#)\s*/i, "poste ")}` : principal;
}

module.exports = { formaterTelephone };
