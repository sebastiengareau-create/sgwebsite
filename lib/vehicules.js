// Dossier véhicule d'un client — validation et formatage partagés entre les
// formulaires (navigateur) et les routes API (serveur), donc aucune
// dépendance serveur ici.

const LONGUEUR_NIV = 17;
const LONGUEUR_MAX_PLAQUE = 8;

// Un NIV (VIN) moderne compte exactement 17 caractères, chiffres et lettres
// majuscules sauf I, O et Q (trop faciles à confondre avec 1 et 0).
const CARACTERES_NIV = /^[A-HJ-NPR-Z0-9]*$/;

// Valeur de chaque caractère pour le chiffre de contrôle (position 9)
const TRANSLITTERATION = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const POIDS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

// Code d'année (position 10) — le cycle se répète aux 30 ans
const CODES_ANNEE = "ABCDEFGHJKLMNPRSTVWXY123456789";

function nettoyerNiv(valeur) {
  return String(valeur || "").toUpperCase().replace(/[\s-]/g, "");
}

function nettoyerPlaque(valeur) {
  return String(valeur || "").toUpperCase().replace(/\s+/g, " ").trim();
}

function chiffreControleNiv(niv) {
  let somme = 0;
  for (let i = 0; i < LONGUEUR_NIV; i++) {
    const c = niv[i];
    const valeur = /\d/.test(c) ? Number(c) : TRANSLITTERATION[c];
    somme += valeur * POIDS[i];
  }
  const reste = somme % 11;
  return reste === 10 ? "X" : String(reste);
}

// → { erreur } si le NIV est inutilisable, sinon { avertissement? }.
// Un chiffre de contrôle qui ne concorde pas n'est qu'un avertissement :
// il est obligatoire en Amérique du Nord, mais pas sur tous les véhicules
// importés d'ailleurs.
function validerNiv(valeur) {
  const niv = nettoyerNiv(valeur);
  if (!niv) return {};
  if (!CARACTERES_NIV.test(niv)) {
    return { erreur: "Le NIV ne peut contenir que des chiffres et des lettres, sauf I, O et Q." };
  }
  if (niv.length !== LONGUEUR_NIV) {
    return { erreur: `Le NIV doit compter exactement ${LONGUEUR_NIV} caractères (${niv.length} entré${niv.length > 1 ? "s" : ""}).` };
  }
  if (chiffreControleNiv(niv) !== niv[8]) {
    return { avertissement: "Le chiffre de contrôle du NIV (9e caractère) ne concorde pas — vérifie qu'il n'y a pas d'erreur de frappe." };
  }
  return {};
}

// Année modèle déduite du 10e caractère. Pour les autos et camions légers,
// un 7e caractère alphabétique indique le cycle 2010-2039, numérique 1980-2009.
function anneeDepuisNiv(valeur) {
  const niv = nettoyerNiv(valeur);
  if (niv.length !== LONGUEUR_NIV) return null;
  const index = CODES_ANNEE.indexOf(niv[9]);
  if (index < 0) return null;
  const cycleRecent = /[A-Z]/.test(niv[6]);
  const annee = 1980 + index + (cycleRecent ? 30 : 0);
  return annee > new Date().getFullYear() + 2 ? annee - 30 : annee;
}

// Plaque du Québec : 6 ou 7 caractères, lettres, chiffres, parfois une
// espace ou un tiret. On reste permissif (plaques d'ailleurs, commerciales).
function validerPlaque(valeur) {
  const plaque = nettoyerPlaque(valeur);
  if (!plaque) return {};
  if (!/^[A-Z0-9 -]+$/.test(plaque)) return { erreur: "La plaque ne peut contenir que des lettres et des chiffres." };
  if (plaque.replace(/[ -]/g, "").length > LONGUEUR_MAX_PLAQUE) {
    return { erreur: `La plaque compte au plus ${LONGUEUR_MAX_PLAQUE} caractères.` };
  }
  return {};
}

// Normalise ce qu'un formulaire ou le site web envoie → { data } prêt pour
// Prisma, ou { erreur }. Un véhicule sans aucune information est « vide ».
function normaliserVehicule(entree) {
  const e = entree || {};
  const anneeTexte = String(e.annee ?? "").trim();
  const annee = anneeTexte ? Number(anneeTexte) : null;
  if (anneeTexte && (!Number.isInteger(annee) || annee < 1900 || annee > new Date().getFullYear() + 2)) {
    return { erreur: "Année du véhicule invalide." };
  }
  const niv = nettoyerNiv(e.niv);
  const plaque = nettoyerPlaque(e.plaque);
  const verifNiv = validerNiv(niv);
  if (verifNiv.erreur) return { erreur: verifNiv.erreur };
  const verifPlaque = validerPlaque(plaque);
  if (verifPlaque.erreur) return { erreur: verifPlaque.erreur };

  const texte = (v) => String(v ?? "").trim().slice(0, 100) || null;
  const data = {
    annee,
    marque: texte(e.marque),
    modele: texte(e.modele),
    version: texte(e.version),
    niv: niv || null,
    plaque: plaque || null,
  };
  const vide = Object.values(data).every((v) => v === null);
  return { data, vide };
}

// « 2019 Honda Civic EX » — utilisé partout où le véhicule est affiché
function libelleVehicule(v) {
  if (!v) return "";
  return [v.annee, v.marque, v.modele, v.version].filter(Boolean).join(" ");
}

// Ligne complète : « 2019 Honda Civic EX · Plaque ABC 123 · NIV 2HGFC… »
function descriptionVehicule(v) {
  if (!v) return "";
  return [libelleVehicule(v) || "Véhicule", v.plaque && `Plaque ${v.plaque}`, v.niv && `NIV ${v.niv}`].filter(Boolean).join(" · ");
}

module.exports = {
  LONGUEUR_NIV,
  LONGUEUR_MAX_PLAQUE,
  nettoyerNiv,
  nettoyerPlaque,
  validerNiv,
  validerPlaque,
  anneeDepuisNiv,
  normaliserVehicule,
  libelleVehicule,
  descriptionVehicule,
};
