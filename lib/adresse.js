// Adresse postale des clients et fournisseurs (adresse, ville, province,
// code postal) — listes, normalisation et formatage partagés entre les
// formulaires (navigateur), les routes API et l'import Excel, donc aucune
// dépendance serveur ici.

// Provinces et territoires canadiens — la valeur enregistrée est le code
// postal officiel à deux lettres (ex. « QC »).
const PROVINCES = [
  { code: "QC", nom: "Québec" },
  { code: "ON", nom: "Ontario" },
  { code: "NB", nom: "Nouveau-Brunswick" },
  { code: "NS", nom: "Nouvelle-Écosse" },
  { code: "PE", nom: "Île-du-Prince-Édouard" },
  { code: "NL", nom: "Terre-Neuve-et-Labrador" },
  { code: "MB", nom: "Manitoba" },
  { code: "SK", nom: "Saskatchewan" },
  { code: "AB", nom: "Alberta" },
  { code: "BC", nom: "Colombie-Britannique" },
  { code: "YT", nom: "Yukon" },
  { code: "NT", nom: "Territoires du Nord-Ouest" },
  { code: "NU", nom: "Nunavut" },
];

// Province proposée par défaut à la création d'une fiche
const PROVINCE_DEFAUT = "QC";

const sansAccents = (t) =>
  String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Autres façons d'écrire chaque province (anglais, abréviations courantes)
const AUTRES_NOMS = {
  QC: ["quebec", "que", "qc", "pq", "province de quebec"],
  ON: ["ontario", "ont", "on"],
  NB: ["nouveau brunswick", "new brunswick", "nb", "n b"],
  NS: ["nouvelle ecosse", "nova scotia", "ns", "n e"],
  PE: ["ile du prince edouard", "prince edward island", "pei", "ipe", "pe"],
  NL: ["terre neuve et labrador", "terre neuve", "newfoundland and labrador", "newfoundland", "nl", "tnl"],
  MB: ["manitoba", "man", "mb"],
  SK: ["saskatchewan", "sask", "sk"],
  AB: ["alberta", "alta", "ab"],
  BC: ["colombie britannique", "british columbia", "cb", "bc"],
  YT: ["yukon", "yt", "yk"],
  NT: ["territoires du nord ouest", "northwest territories", "tno", "nwt", "nt"],
  NU: ["nunavut", "nu"],
};
const CODE_PAR_TEXTE = {};
for (const p of PROVINCES) CODE_PAR_TEXTE[sansAccents(p.nom)] = p.code;
for (const [code, noms] of Object.entries(AUTRES_NOMS)) for (const n of noms) CODE_PAR_TEXTE[n] = code;

// « Québec », « que », « QC », « Ontario »… → code à deux lettres, ou null
// si le texte n'est pas reconnu comme une province.
function codeProvince(texte) {
  const t = sansAccents(texte);
  if (!t) return null;
  return CODE_PAR_TEXTE[t] || null;
}

// Pour enregistrer : code reconnu, sinon le texte tel quel (raccourci), sinon null
function normaliserProvince(texte) {
  const brut = String(texte || "").trim();
  if (!brut) return null;
  return codeProvince(brut) || brut.slice(0, 40);
}

// Code postal canadien : « h1a1a1 », « H1A-1A1 » → « H1A 1A1 ». Un code
// étranger (ex. ZIP américain) est conservé tel quel.
const MOTIF_CODE_POSTAL = /\b([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])[ -]?(\d[ABCEGHJ-NPRSTV-Z]\d)\b/i;
function normaliserCodePostal(texte) {
  const brut = String(texte || "").trim();
  if (!brut) return null;
  const m = brut.replace(/\s+/g, "").match(/^([A-Z]\d[A-Z])-?(\d[A-Z]\d)$/i);
  return m ? `${m[1]} ${m[2]}`.toUpperCase() : brut.toUpperCase();
}

// « Montréal QC H1A 1A1 » — ville, province et code postal sur une ligne
function ligneVille({ ville, province, codePostal } = {}) {
  return [ville, province, codePostal].filter(Boolean).join(" ");
}

// Adresse complète sur une ligne : « 12 rue Principale, Montréal QC H1A 1A1 »
function adresseComplete(fiche = {}) {
  return [fiche.adresse, ligneVille(fiche)].filter(Boolean).join(", ");
}

// Découpe une adresse écrite d'un bloc (« 12 rue Principale, Montréal,
// Québec H1A 1A1 ») en { adresse, ville, province, codePostal } — sert
// à l'import quand le fichier n'a qu'une colonne « Adresse ». Ce qui n'est
// pas reconnu reste dans `adresse`.
function decouperAdresse(texte) {
  let reste = String(texte || "").replace(/\s+/g, " ").trim();
  const resultat = { adresse: null, ville: null, province: null, codePostal: null };
  if (!reste) return resultat;

  const cp = reste.match(MOTIF_CODE_POSTAL);
  if (cp) {
    resultat.codePostal = `${cp[1]} ${cp[2]}`.toUpperCase();
    reste = (reste.slice(0, cp.index) + reste.slice(cp.index + cp[0].length)).replace(/[\s,]+$/, "").replace(/,\s*,/g, ",").trim();
  }

  // Province : dernier segment (après virgule) ou derniers mots. « Québec »
  // seul après l'adresse (« 12 rue X, Québec ») est pris pour la ville : il
  // faut une ville avant pour le lire comme province.
  const segments = reste.split(",").map((s) => s.trim()).filter(Boolean);
  if (segments.length > 2 && codeProvince(segments[segments.length - 1])) {
    resultat.province = codeProvince(segments.pop());
  } else if (segments.length > 0) {
    const mots = segments[segments.length - 1].split(" ");
    for (let n = Math.min(5, mots.length - 1); n >= 1; n--) {
      const code = codeProvince(mots.slice(-n).join(" "));
      if (code) {
        resultat.province = code;
        segments[segments.length - 1] = mots.slice(0, -n).join(" ");
        break;
      }
    }
  }

  // Ville : le dernier segment, s'il reste au moins une adresse avant
  const nonVides = segments.filter(Boolean);
  if (nonVides.length > 1) resultat.ville = nonVides.pop();
  resultat.adresse = nonVides.join(", ") || null;
  return resultat;
}

// Case « Ville » qui contient aussi la province ou le code postal
// (« Laval, QC », « Lévis (Québec) », « Gatineau QC J8T 1A1 ») →
// { ville, province, codePostal }. « Québec » seul reste la ville.
function decouperVille(texte) {
  const brut = String(texte || "").replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  if (!brut) return { ville: null, province: null, codePostal: null };
  const { ville, province, codePostal } = decouperAdresse(`-, ${brut}`);
  return { ville: ville || brut, province, codePostal };
}

module.exports = {
  decouperVille,
  PROVINCES,
  PROVINCE_DEFAUT,
  codeProvince,
  normaliserProvince,
  normaliserCodePostal,
  ligneVille,
  adresseComplete,
  decouperAdresse,
  MOTIF_CODE_POSTAL,
};
