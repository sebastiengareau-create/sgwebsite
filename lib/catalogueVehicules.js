// Catalogue des véhicules pour les listes déroulantes du dossier véhicule :
// année → marque → modèle (NHTSA vPIC, autos, camions et VUS/fourgonnettes
// de 1990 à aujourd'hui) → version (lib/versionsVehicules.js).
//
// Côté serveur seulement — le navigateur interroge /api/vehicules/catalogue
// pour ne recevoir que la liste dont il a besoin, pas le catalogue au complet.
import catalogue from "./catalogueVehiculesNhtsa.json";
import { versionsPour } from "./versionsVehicules";
import { nettoyerNiv, validerNiv, anneeDepuisNiv } from "./vehicules";

// Marques courantes au Québec, affichées en premier dans la liste
const MARQUES_POPULAIRES = [
  "ACURA", "AUDI", "BMW", "BUICK", "CADILLAC", "CHEVROLET", "CHRYSLER", "DODGE", "FIAT", "FORD",
  "GENESIS", "GMC", "HONDA", "HYUNDAI", "INFINITI", "JAGUAR", "JEEP", "KIA", "LAND ROVER", "LEXUS",
  "LINCOLN", "MAZDA", "MERCEDES-BENZ", "MINI", "MITSUBISHI", "NISSAN", "POLESTAR", "PONTIAC", "PORSCHE",
  "RAM", "RIVIAN", "SATURN", "SUBARU", "SUZUKI", "TESLA", "TOYOTA", "VOLKSWAGEN", "VOLVO",
];

// Mots qui restent en majuscules dans le nom affiché
const ACRONYMES = new Set([
  "AAS", "AC", "AM", "AMD", "BBC", "BMW", "BTL", "BXR", "BYD", "CCC", "CX", "EMA", "EV", "EVT", "FF",
  "FWD", "GMC", "GP", "HMC", "IC", "IEV", "II", "JAC", "JLG", "KME", "KSM", "LA", "LLC", "LTD", "MB",
  "MGS", "MK", "ND", "PAS", "RPM", "RS", "RUF", "SAW", "SCG", "SF", "SPV", "SSC", "TEC", "TRX", "UCC",
  "UD", "US", "USA", "XOS", "ZM",
]);
const NOMS_SPECIAUX = { MCLAREN: "McLaren", "MCLAREN AUTOMOTIVE": "McLaren Automotive", "TH!NK": "Th!nk" };

function nomMarque(cle) {
  if (NOMS_SPECIAUX[cle]) return NOMS_SPECIAUX[cle];
  return cle
    .split(" ")
    .map((mot) => (ACRONYMES.has(mot.replace(/[.,()]/g, "")) ? mot : mot.toLowerCase().replace(/(^|[-(/])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase())))
    .join(" ");
}

// "1990-1995,1998-2027" → vrai si l'année est couverte
function couvreAnnee(plages, annee) {
  return plages.split(",").some((plage) => {
    const [debut, fin] = plage.split("-").map(Number);
    return annee >= debut && annee <= (fin || debut);
  });
}

const MARQUES = Object.keys(catalogue.marques).map((cle) => ({ cle, nom: nomMarque(cle) }));

function anneesDisponibles() {
  let max = 0, min = Infinity;
  for (const modeles of Object.values(catalogue.marques)) {
    for (const plages of Object.values(modeles)) {
      for (const n of plages.split(/[,-]/).map(Number)) {
        if (n > max) max = n;
        if (n < min) min = n;
      }
    }
  }
  const annees = [];
  for (let a = max; a >= min; a--) annees.push(a);
  return annees;
}

// Retrouve la clé du catalogue à partir d'un nom (« Honda », « HONDA »,
// « Mercedes-Benz »…) — null si la marque n'y est pas.
function cleMarque(nom) {
  const n = String(nom || "").trim().toUpperCase();
  if (!n) return null;
  return MARQUES.find((m) => m.cle === n || m.nom.toUpperCase() === n)?.cle || null;
}

// → { populaires: [{cle, nom}], autres: [{cle, nom}] } ; sans année — ou
// pour une année hors catalogue (avant 1990) — toutes les marques
function marquesPour(annee) {
  let offertes = MARQUES.filter((m) => !annee || Object.values(catalogue.marques[m.cle]).some((p) => couvreAnnee(p, annee)));
  if (offertes.length === 0) offertes = MARQUES;
  const tri = (a, b) => a.nom.localeCompare(b.nom, "fr");
  return {
    populaires: offertes.filter((m) => MARQUES_POPULAIRES.includes(m.cle)).sort(tri),
    autres: offertes.filter((m) => !MARQUES_POPULAIRES.includes(m.cle)).sort(tri),
  };
}

function modelesPour(marque, annee) {
  const cle = cleMarque(marque);
  if (!cle) return [];
  const tous = Object.entries(catalogue.marques[cle]);
  const deLAnnee = tous.filter(([, plages]) => !annee || couvreAnnee(plages, annee));
  return (deLAnnee.length ? deLAnnee : tous)
    .map(([modele]) => modele)
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
}

function versionsDuModele(marque, modele) {
  return versionsPour(cleMarque(marque) || String(marque || "").toUpperCase(), modele);
}

// Nom de modèle tel qu'écrit dans le catalogue (« CIVIC » → « Civic »)
function modeleCanonique(marque, modele) {
  const cle = cleMarque(marque);
  const m = String(modele || "").trim();
  if (!cle || !m) return m || null;
  return Object.keys(catalogue.marques[cle]).find((x) => x.toUpperCase() === m.toUpperCase()) || m;
}

// Constructeur selon les 3 premiers caractères du NIV (WMI) — les plus
// courants au Québec. Sert au décodage hors ligne quand la NHTSA ne répond pas.
const WMI = {
  "1FA": "FORD", "1FB": "FORD", "1FC": "FORD", "1FD": "FORD", "1FM": "FORD", "1FT": "FORD", "1FV": "FREIGHTLINER",
  "2FA": "FORD", "2FM": "FORD", "2FT": "FORD", "3FA": "FORD", "3FM": "FORD", "3FT": "FORD", "1ZV": "FORD", "NM0": "FORD",
  "1LN": "LINCOLN", "2LM": "LINCOLN", "5LM": "LINCOLN", "1ME": "MERCURY", "2ME": "MERCURY",
  "1G1": "CHEVROLET", "1GC": "CHEVROLET", "1GN": "CHEVROLET", "1GB": "CHEVROLET", "2G1": "CHEVROLET", "2GN": "CHEVROLET",
  "2GC": "CHEVROLET", "3G1": "CHEVROLET", "3GN": "CHEVROLET", "3GC": "CHEVROLET", "KL7": "CHEVROLET", "KL8": "CHEVROLET",
  "1GT": "GMC", "1GK": "GMC", "2GT": "GMC", "2GK": "GMC", "3GT": "GMC", "3GK": "GMC",
  "1G4": "BUICK", "2G4": "BUICK", "KL4": "BUICK", "LRB": "BUICK", "1G6": "CADILLAC", "1GY": "CADILLAC",
  "1G2": "PONTIAC", "2G2": "PONTIAC", "1G8": "SATURN", "5GZ": "SATURN",
  "1C3": "CHRYSLER", "2C3": "CHRYSLER", "2C4": "CHRYSLER", "1C4": "JEEP", "1J4": "JEEP", "1J8": "JEEP", "ZAC": "JEEP",
  "1B3": "DODGE", "2B3": "DODGE", "1D3": "DODGE", "1D7": "DODGE", "2D3": "DODGE", "2D4": "DODGE", "3D4": "DODGE",
  "1C6": "RAM", "3C6": "RAM", "3C7": "RAM", "3D7": "RAM", "ZFB": "RAM",
  "1HG": "HONDA", "2HG": "HONDA", "2HK": "HONDA", "5FN": "HONDA", "5J6": "HONDA", "7FA": "HONDA", "JHM": "HONDA", "SHH": "HONDA", "SHS": "HONDA",
  "19U": "ACURA", "2HN": "ACURA", "5J8": "ACURA", "JH4": "ACURA",
  "2T1": "TOYOTA", "2T3": "TOYOTA", "4T1": "TOYOTA", "4T3": "TOYOTA", "4T4": "TOYOTA", "5TD": "TOYOTA", "5TF": "TOYOTA",
  "5TE": "TOYOTA", "5YF": "TOYOTA", "7MU": "TOYOTA", "JTD": "TOYOTA", "JTE": "TOYOTA", "JTK": "TOYOTA", "JTM": "TOYOTA", "JTN": "TOYOTA", "JTL": "TOYOTA",
  "2T2": "LEXUS", "JTH": "LEXUS", "JTJ": "LEXUS", "58A": "LEXUS",
  "1N4": "NISSAN", "1N6": "NISSAN", "3N1": "NISSAN", "3N6": "NISSAN", "5N1": "NISSAN", "JN1": "NISSAN", "JN8": "NISSAN", "SJN": "NISSAN",
  "JNK": "INFINITI", "JNR": "INFINITI", "5N3": "INFINITI",
  "JM1": "MAZDA", "JM3": "MAZDA", "3MZ": "MAZDA", "3MV": "MAZDA", "7MM": "MAZDA",
  "JF1": "SUBARU", "JF2": "SUBARU", "4S3": "SUBARU", "4S4": "SUBARU",
  "JA3": "MITSUBISHI", "JA4": "MITSUBISHI", "ML3": "MITSUBISHI", "4A3": "MITSUBISHI",
  "KMH": "HYUNDAI", "KM8": "HYUNDAI", "5NM": "HYUNDAI", "5NP": "HYUNDAI", "5NT": "HYUNDAI", "3H3": "HYUNDAI",
  "KNA": "KIA", "KND": "KIA", "5XX": "KIA", "5XY": "KIA", "3KP": "KIA", "KMU": "GENESIS", "KMT": "GENESIS",
  "3VW": "VOLKSWAGEN", "1VW": "VOLKSWAGEN", "WVW": "VOLKSWAGEN", "WVG": "VOLKSWAGEN", "1V2": "VOLKSWAGEN", "3VV": "VOLKSWAGEN",
  "WAU": "AUDI", "WA1": "AUDI", "WUA": "AUDI", "TRU": "AUDI",
  "WBA": "BMW", "WBS": "BMW", "WBX": "BMW", "WBY": "BMW", "5UX": "BMW", "5UJ": "BMW", "5YM": "BMW",
  "WMW": "MINI", "WDB": "MERCEDES-BENZ", "WDC": "MERCEDES-BENZ", "WDD": "MERCEDES-BENZ", "W1K": "MERCEDES-BENZ",
  "W1N": "MERCEDES-BENZ", "W1V": "MERCEDES-BENZ", "W1W": "MERCEDES-BENZ", "4JG": "MERCEDES-BENZ", "55S": "MERCEDES-BENZ",
  "WP0": "PORSCHE", "WP1": "PORSCHE", "YV1": "VOLVO", "YV4": "VOLVO", "7JR": "VOLVO", "7JD": "VOLVO", "LYV": "VOLVO",
  "SAL": "LAND ROVER", "SAJ": "JAGUAR", "SAD": "JAGUAR", "ZFA": "FIAT", "3C3": "FIAT", "ZAR": "ALFA ROMEO", "ZAS": "ALFA ROMEO",
  "5YJ": "TESLA", "7SA": "TESLA", "7G2": "TESLA", "LRW": "TESLA", "XP7": "TESLA", "7PD": "RIVIAN", "LPS": "POLESTAR", "YSM": "POLESTAR",
  "JS1": "SUZUKI", "JS2": "SUZUKI", "JS3": "SUZUKI", "2S3": "SUZUKI", "WME": "SMART",
};

function marqueDepuisNiv(niv) {
  const cle = WMI[String(niv || "").toUpperCase().slice(0, 3)];
  return cle ? nomMarque(cle) : null;
}

// Décode un NIV → { niv, avertissement, annee, marque, modele, version,
// source: "NHTSA" | "local" } ou { erreur }. Interroge d'abord le décodeur
// public de la NHTSA (gratuit, sans clé) pour le modèle et la version ; s'il
// ne répond pas, on se rabat sur ce que le NIV dit à lui seul (année au 10e
// caractère, constructeur aux 3 premiers).
const DELAI_NHTSA_MS = 5000;

async function decoderNiv(valeur) {
  const niv = nettoyerNiv(valeur);
  const verif = validerNiv(niv);
  if (!niv || verif.erreur) return { erreur: verif.erreur || "NIV manquant." };

  const local = { annee: anneeDepuisNiv(niv), marque: marqueDepuisNiv(niv), modele: null, version: null };
  const distant = await decoderNhtsa(niv);
  const resultat = distant
    ? { annee: distant.annee || local.annee, marque: distant.marque || local.marque, modele: distant.modele, version: distant.version, source: "NHTSA" }
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
    if (!r || !r.Make) return null;
    const cle = cleMarque(r.Make);
    const marque = cle ? nomMarque(cle) : r.Make;
    return {
      annee: Number(r.ModelYear) || null,
      marque,
      modele: r.Model ? modeleCanonique(marque, r.Model) : null,
      version: [r.Trim, r.Series].map((v) => (v || "").trim()).find(Boolean) || null,
    };
  } catch {
    return null;
  }
}

export { decoderNiv, anneesDisponibles, marquesPour, modelesPour, versionsDuModele, cleMarque, nomMarque, modeleCanonique, marqueDepuisNiv };
export const SOURCE_CATALOGUE = catalogue.source;
