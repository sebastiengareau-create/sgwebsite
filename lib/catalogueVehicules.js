// Catalogue des véhicules pour les listes déroulantes du dossier véhicule —
// VERSION VR PREMIUM : année → marque de VR → modèle de VR → type de VR
// (Classe A, B, C, roulotte, sellette…), à partir de
// lib/catalogueVehiculesVr.json. Le modèle de base (branche main) utilise
// plutôt le catalogue automobile NHTSA ; les fonctions exportées sont les
// mêmes, pour que le reste du logiciel ne change pas d'une branche à l'autre.
//
// Contrairement aux autos, les modèles de VR ne sont pas filtrés par année :
// une même gamme (ex. Jayco Jay Flight) est offerte pendant des décennies.
//
// Côté serveur seulement — le navigateur interroge /api/vehicules/catalogue
// pour ne recevoir que la liste dont il a besoin.
import catalogue from "./catalogueVehiculesVr.json";
import { nettoyerNiv, validerNiv, anneeDepuisNiv } from "./vehicules";

// Tous les types de VR, proposés dans la 4e liste après le ou les types
// connus du modèle choisi
const TYPES_VR = [
  "Classe A", "Classe B (fourgonnette)", "Classe B+", "Classe C",
  "Roulotte de voyage", "Sellette (fifth wheel)", "Roulotte à rampe (toy hauler)", "Roulotte hybride",
  "Tente-roulotte", "Caravane portée (campeur)", "Mini-roulotte (teardrop)", "Roulotte de parc (park model)",
];

const ANNEE_MIN = 1970;

// La clé et le nom affiché sont identiques dans le catalogue VR
const MARQUES = Object.keys(catalogue.marques).map((cle) => ({ cle, nom: cle }));

function nomMarque(cle) {
  return MARQUES.find((m) => m.cle.toUpperCase() === String(cle || "").toUpperCase())?.nom || cle;
}

function anneesDisponibles() {
  const annees = [];
  for (let a = new Date().getFullYear() + 1; a >= ANNEE_MIN; a--) annees.push(a);
  return annees;
}

// Retrouve la marque du catalogue à partir d'un nom (« JAYCO », « Jayco »,
// ou un nom de fabricant plus long comme « WINNEBAGO INDUSTRIES » renvoyé
// par la NHTSA) — null si la marque n'y est pas.
function cleMarque(nom) {
  const n = String(nom || "").trim().toUpperCase();
  if (!n) return null;
  const exacte = MARQUES.find((m) => m.cle.toUpperCase() === n);
  if (exacte) return exacte.cle;
  const premierMot = (texte) => texte.split(/[\s-]+/)[0];
  return MARQUES.find((m) => n.startsWith(`${m.cle.toUpperCase()} `) || premierMot(m.cle.toUpperCase()) === premierMot(n))?.cle || null;
}

// → { populaires: [{cle, nom}], autres: [{cle, nom}] } — mêmes marques pour
// toutes les années
function marquesPour() {
  const tri = (a, b) => a.nom.localeCompare(b.nom, "fr");
  const populaires = new Set(catalogue.populaires);
  return {
    populaires: MARQUES.filter((m) => populaires.has(m.cle)).sort(tri),
    autres: MARQUES.filter((m) => !populaires.has(m.cle)).sort(tri),
  };
}

function modelesPour(marque) {
  const cle = cleMarque(marque);
  if (!cle) return [];
  return Object.keys(catalogue.marques[cle]).sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
}

// Le ou les types connus du modèle d'abord, puis tous les autres types
function versionsDuModele(marque, modele) {
  const cle = cleMarque(marque);
  const connus = cle ? catalogue.marques[cle][modeleCanonique(cle, modele)] || [] : [];
  return [...new Set([...connus, ...TYPES_VR])];
}

// Nom de modèle tel qu'écrit dans le catalogue (« GREYHAWK » → « Greyhawk »)
function modeleCanonique(marque, modele) {
  const cle = cleMarque(marque);
  const m = String(modele || "").trim();
  if (!cle || !m) return m || null;
  return Object.keys(catalogue.marques[cle]).find((x) => x.toUpperCase() === m.toUpperCase()) || m;
}

// Hors ligne, le NIV ne permet pas de connaître la marque du VR : les 3
// premiers caractères désignent souvent le fabricant du châssis (Ford,
// Mercedes-Benz…), pas celui du VR.
function marqueDepuisNiv() {
  return null;
}

// Décode un NIV → { niv, avertissement, annee, marque, modele, version,
// source: "NHTSA" | "local" } ou { erreur }. Le décodeur public de la NHTSA
// donne l'année, et la marque et le modèle quand le NIV est celui du VR
// lui-même (roulottes, sellettes, la plupart des Classe A). Pour un Classe B
// ou C, le NIV est souvent celui du châssis : on ne garde alors que l'année.
const DELAI_NHTSA_MS = 5000;

async function decoderNiv(valeur) {
  const niv = nettoyerNiv(valeur);
  const verif = validerNiv(niv);
  if (!niv || verif.erreur) return { erreur: verif.erreur || "NIV manquant." };

  const local = { annee: anneeDepuisNiv(niv), marque: null, modele: null, version: null };
  const distant = await decoderNhtsa(niv);
  const resultat = distant
    ? { annee: distant.annee || local.annee, marque: distant.marque, modele: distant.modele, version: null, source: "NHTSA" }
    : { ...local, source: "local" };
  return { niv, avertissement: verif.avertissement || null, ...resultat };
}

async function decoderNhtsa(niv) {
  try {
    const reponse = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${niv}?format=json`, {
      signal: AbortSignal.timeout(DELAI_NHTSA_MS),
      cache: "no-store",
    });
    if (!reponse.ok) return null;
    const r = (await reponse.json())?.Results?.[0];
    if (!r) return null;
    // Marque et modèle seulement s'ils correspondent à un VR du catalogue
    const cle = cleMarque(r.Make) || cleMarque(r.Manufacturer);
    const modele = cle && r.Model ? modeleCanonique(cle, r.Model) : null;
    return {
      annee: Number(r.ModelYear) || null,
      marque: cle,
      modele: modele && catalogue.marques[cle][modele] ? modele : null,
    };
  } catch {
    return null;
  }
}

export { decoderNiv, anneesDisponibles, marquesPour, modelesPour, versionsDuModele, cleMarque, nomMarque, modeleCanonique, marqueDepuisNiv };
export const SOURCE_CATALOGUE = catalogue.source;
