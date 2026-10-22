// Google Places (API « Places API (New) ») : suggestions d'adresses
// complètes pendant la saisie d'un champ Adresse. La clé de l'installation
// (Paramètres → Google Places, ou variable GOOGLE_PLACES_API_KEY) reste côté
// serveur : le navigateur passe par /api/adresse/suggestions et
// /api/adresse/details. Sans clé, les champs n'offrent que les suggestions
// locales de ville (lib/secteursPostaux.js, lib/municipalitesQuebec.js).
//
// Facturation : les suggestions d'une même saisie partagent un jeton de
// session qui se termine par la lecture de l'adresse choisie ; Google ne
// facture alors que cette lecture (Place Details Essentials).
// Référence : https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
const { prisma } = require("./prisma");
const { normaliserCodePostal } = require("./adresse");

const CLE = "google_places_cle";
const URL_API = "https://places.googleapis.com/v1";

async function lireCle() {
  const param = await prisma.parametre.findUnique({ where: { cle: CLE } });
  return param?.valeur || process.env.GOOGLE_PLACES_API_KEY || "";
}

// → { cleEnregistree: bool (dans l'appli), variable: bool (GOOGLE_PLACES_API_KEY) }
async function lireConfig() {
  const param = await prisma.parametre.findUnique({ where: { cle: CLE } });
  return { cleEnregistree: !!param?.valeur, variable: !!process.env.GOOGLE_PLACES_API_KEY };
}

async function appeler(cle, chemin, { corps, champs } = {}) {
  let res;
  try {
    res = await fetch(`${URL_API}${chemin}`, {
      method: corps ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": cle,
        ...(champs && { "X-Goog-FieldMask": champs }),
      },
      body: corps ? JSON.stringify(corps) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error("Google ne répond pas — réessaie dans un moment.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Places : ${data.error?.message || `erreur ${res.status}`}`);
  return data;
}

// « 123 rue Princ » → [{ id, principal: "123 Rue Principale", secondaire: "Saint-Jérôme, QC, Canada" }]
async function suggerer(cle, texte, jeton) {
  const data = await appeler(cle, "/places:autocomplete", {
    corps: {
      input: texte,
      sessionToken: jeton || undefined,
      includedRegionCodes: ["ca"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      languageCode: "fr",
      regionCode: "ca",
    },
  });
  return (data.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      id: p.placeId,
      principal: p.structuredFormat?.mainText?.text || p.text?.text || "",
      secondaire: p.structuredFormat?.secondaryText?.text || "",
    }));
}

// Adresse choisie → { adresse: "4-123 Rue Principale", ville, province: "QC", codePostal }
async function detailler(cle, id, jeton) {
  const params = new URLSearchParams({ languageCode: "fr", regionCode: "ca" });
  if (jeton) params.set("sessionToken", jeton);
  const data = await appeler(cle, `/places/${encodeURIComponent(id)}?${params}`, { champs: "addressComponents" });
  const composante = (type, court = false) => {
    const c = (data.addressComponents || []).find((x) => x.types?.includes(type));
    return (court ? c?.shortText : c?.longText) || "";
  };
  const numero = composante("street_number");
  const rue = composante("route");
  const unite = composante("subpremise");
  const civique = [unite, numero].filter(Boolean).join("-");
  return {
    adresse: [civique, rue].filter(Boolean).join(" ") || null,
    ville: composante("locality") || composante("postal_town") || composante("sublocality_level_1") || composante("administrative_area_level_3") || null,
    province: composante("administrative_area_level_1", true) || null,
    codePostal: normaliserCodePostal(composante("postal_code")),
  };
}

module.exports = { CLE, lireCle, lireConfig, suggerer, detailler };
