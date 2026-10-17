// Catalogue des véhicules récréatifs (profil typeVehicules: "vr", voir
// lib/client.js) : année → marque de VR → modèle de VR → type de VR
// (Classe A, B, C, roulotte, sellette…), à partir de
// lib/catalogueVehiculesVr.json. Mêmes fonctions exportées que
// lib/catalogueAuto.js ; on passe par lib/catalogueVehicules.js.
//
// Contrairement aux autos, les modèles de VR ne sont pas filtrés par année :
// une même gamme (ex. Jayco Jay Flight) est offerte pendant des décennies.
import catalogue from "./catalogueVehiculesVr.json";
import { nettoyerNiv, validerNiv, anneeDepuisNiv } from "./vehicules";

// Tous les types de VR, proposés dans la 4e liste après le ou les types
// connus du modèle choisi
const TYPES_VR = [
  "Classe A", "Classe B (fourgonnette)", "Classe B+", "Classe C",
  "Roulotte de voyage", "Sellette (fifth wheel)", "Roulotte à rampe (toy hauler)", "Roulotte hybride",
  "Tente-roulotte", "Caravane portée (campeur)", "Mini-roulotte (teardrop)", "Roulotte de parc (park model)",
  "Trailer",
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
// « KZ » pour KZ RV, ou un nom de fabricant plus long comme « WINNEBAGO
// INDUSTRIES, INC. » renvoyé par la NHTSA) — null si la marque n'y est pas.
// On compare le nom entier, sans les mots génériques de la fin (RV, Coach,
// Inc.…) : un seul mot en commun ne suffit pas (« American » n'est pas
// American Coach).
const MOTS_GENERIQUES = new Set([
  "RV", "RVS", "COACH", "MOTOR", "MOTORHOMES", "MOTORHOME", "LUXURY", "SUITES", "INDUSTRIES",
  "MANUFACTURING", "MFG", "RECREATIONAL", "VEHICLE", "VEHICLES", "CAMPER", "CAMPERS", "INC", "LLC", "LTD", "LTEE", "CORP", "CORPORATION", "CO", "COMPANY",
]);

function noyauMarque(nom) {
  const mots = String(nom || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  while (mots.length > 1 && MOTS_GENERIQUES.has(mots[mots.length - 1])) mots.pop();
  return mots.join("");
}

const NOYAUX = MARQUES.map((m) => ({ cle: m.cle, noyau: noyauMarque(m.cle) }));

function cleMarque(nom) {
  const n = noyauMarque(nom);
  if (!n) return null;
  return NOYAUX.find((m) => m.noyau === n)?.cle || null;
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

// Décode un NIV → { niv, avertissement, annee, marque, modele, version, note,
// source: "NHTSA" | "local" } ou { erreur }. Le décodeur public de la NHTSA
// donne l'année, et la marque et le modèle quand le NIV est celui du VR
// lui-même (roulottes, sellettes, certains Classe A). Pour la plupart des
// motorisés, le NIV est celui du châssis (Ford F-53, Freightliner,
// Mercedes Sprinter…) : on ne garde alors que l'année, et la note le dit.
const DELAI_NHTSA_MS = 5000;

// Fabricants de châssis : leur NIV ne dit rien de la marque du VR
const FABRICANTS_CHASSIS = new Set([
  "FORD", "CHEVROLET", "GMC", "RAM", "DODGE", "MERCEDESBENZ", "FREIGHTLINER", "SPARTAN", "WORKHORSE",
  "ISUZU", "FIAT", "VOLKSWAGEN", "INTERNATIONAL", "NAVISTAR", "PETERBILT", "KENWORTH", "HINO", "TOYOTA",
  "NISSAN", "ROADMASTER", "OSHKOSH", "MAGNUMCHASSIS", "BLUEBIRD",
].map(noyauMarque));

async function decoderNiv(valeur) {
  const niv = nettoyerNiv(valeur);
  const verif = validerNiv(niv);
  if (!niv || verif.erreur) return { erreur: verif.erreur || "NIV manquant." };

  const local = { annee: anneeDepuisNiv(niv), marque: null, modele: null, version: null, note: null };
  const distant = await decoderNhtsa(niv);
  const resultat = distant
    ? { ...distant, annee: distant.annee || local.annee, source: "NHTSA" }
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
    return interpreterNhtsa(r);
  } catch {
    return null;
  }
}

// Résultat de la NHTSA → { annee, marque, modele, version, note }
function interpreterNhtsa(r) {
  const texte = (v) => String(v || "").trim();
  const annee = Number(r.ModelYear) || null;
  const make = texte(r.Make);
  const vide = { annee, marque: null, modele: null, version: null };

  const chassis = /INCOMPLETE/i.test(texte(r.VehicleType)) || FABRICANTS_CHASSIS.has(noyauMarque(make))
    || (!make && FABRICANTS_CHASSIS.has(noyauMarque(texte(r.Manufacturer).split(/\s+/)[0])));
  if (chassis) {
    const nomChassis = [make || texte(r.Manufacturer), texte(r.Model)].filter(Boolean).join(" ");
    return {
      ...vide,
      note: `NIV du châssis${nomChassis ? ` (${nomChassis})` : ""}, pas du VR : choisis la marque et le modèle du VR dans les listes. L'année du VR peut différer de celle du châssis.`,
    };
  }

  // Le fabricant (Manufacturer) est souvent la société mère d'une autre
  // marque (Forest River pour Coachmen ou Prime Time, Jayco pour Starcraft…) :
  // on ne s'en sert que si la NHTSA ne donne pas de marque.
  const cle = make ? cleMarque(make) : cleMarque(r.Manufacturer);
  if (!cle) {
    return { ...vide, note: make ? `Marque « ${make} » absente du catalogue : choisis-la dans les listes (ou « Autre… »).` : null };
  }
  const modele = modeleDuCatalogue(cle, r.Model) || modeleDuCatalogue(cle, r.Series);
  const types = modele ? catalogue.marques[cle][modele] : [];
  return {
    ...vide,
    marque: cle,
    modele,
    version: types.length === 1 ? types[0] : null,
    note: !modele && texte(r.Model) ? `Modèle « ${texte(r.Model)} » absent du catalogue pour ${cle} : choisis-le dans la liste.` : null,
  };
}

// Modèle du catalogue de la marque qui correspond au nom de la NHTSA : nom
// exact, sinon le plus long modèle par lequel il commence (« ROCKWOOD ULTRA
// LITE » → Rockwood, « EAGLE HT 28.5RSTS » → Eagle HT) — null sinon.
function modeleDuCatalogue(cle, nom) {
  const mots = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  const n = mots(nom);
  if (!n) return null;
  const modeles = Object.keys(catalogue.marques[cle]);
  return modeles.find((m) => mots(m) === n)
    || modeles.filter((m) => n.startsWith(`${mots(m)} `)).sort((a, b) => b.length - a.length)[0]
    || null;
}

export { decoderNiv, anneesDisponibles, marquesPour, modelesPour, versionsDuModele, cleMarque, nomMarque, modeleCanonique, marqueDepuisNiv };
export const SOURCE_CATALOGUE = catalogue.source;
