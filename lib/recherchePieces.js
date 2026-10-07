// Recherche de pièces sur le web, depuis un bon de travail : une recherche
// chez tous les fournisseurs habituels à la fois, et un lien par
// fournisseur, pré-remplis avec la pièce et le véhicule du bon.
//
// Les sites sont réglés dans Paramètres → Sites de pièces (clé Parametre
// ci-dessous, en JSON). Chaque site a une adresse :
// - avec des mots entre accolades : adresse de recherche du site, ouverte
//   directement. {q} = pièce + véhicule, {piece} = pièce seule, {annee},
//   {marque}, {modele}, {niv} (ex. https://www.exemple.ca/recherche?q={q}) ;
// - sinon : un domaine (ex. exemple.ca), cherché par Google limité à ce
//   site — marche pour n'importe quel fournisseur.
// Aucune dépendance serveur ici : le bon (navigateur) bâtit les liens.
const CLE = "recherche_pieces_sites";
const NB_MAX_SITES = 12;
const LONGUEUR_MAX_NOM = 40;
const LONGUEUR_MAX_URL = 300;

// NAPA : sa propre recherche (pièce seule — le véhicule se choisit sur le
// site, avec le NIV copié). RockAuto : son catalogue ouvert sur le véhicule.
const SITES_DEFAUT = [
  { nom: "NAPA Canada", url: "https://www.napacanada.com/fr/search?text={piece}" },
  { nom: "RockAuto", url: "https://www.rockauto.com/fr/catalog/{marque},{annee},{modele}" },
  { nom: "Bumper to Bumper", url: "bumpertobumper.ca" },
];

function lireSites(valeur) {
  if (!valeur) return SITES_DEFAUT;
  try {
    const sites = JSON.parse(valeur);
    return Array.isArray(sites) ? sites : SITES_DEFAUT;
  } catch {
    return SITES_DEFAUT;
  }
}

// Domaine seul (« https://www.napacanada.com/fr/ » → « napacanada.com »),
// ou null si l'adresse n'en est pas un
function domaine(url) {
  const brut = String(url || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(brut) ? brut : null;
}

// Valide la liste reçue de Paramètres → { sites } ou { erreur }
function validerSites(liste) {
  if (!Array.isArray(liste)) return { erreur: "Liste de sites invalide." };
  const sites = [];
  for (const s of liste) {
    const nom = String(s?.nom || "").trim();
    const url = String(s?.url || "").trim();
    if (!nom && !url) continue;
    if (!nom) return { erreur: "Indique le nom de chaque site." };
    if (nom.length > LONGUEUR_MAX_NOM) return { erreur: `Nom trop long : « ${nom} » (${LONGUEUR_MAX_NOM} caractères maximum).` };
    if (url.length > LONGUEUR_MAX_URL) return { erreur: `Adresse trop longue pour « ${nom} ».` };
    if (estAdresseRecherche(url)) {
      if (!/^https:\/\/[^\s]+$/i.test(url)) return { erreur: `Adresse de recherche invalide pour « ${nom} » : elle doit commencer par https://.` };
    } else if (!domaine(url)) {
      return { erreur: `Adresse invalide pour « ${nom} » : mets le domaine (ex. exemple.ca) ou une adresse de recherche avec {q}.` };
    }
    sites.push({ nom, url: estAdresseRecherche(url) ? url : domaine(url) });
  }
  if (sites.length > NB_MAX_SITES) return { erreur: `${NB_MAX_SITES} sites maximum.` };
  return { sites };
}

// Texte du véhicule pour une recherche : « 2019 Honda Civic EX »
function texteVehicule(v) {
  return v ? [v.annee, v.marque, v.modele, v.version].filter(Boolean).join(" ") : "";
}

const MOTS_ADRESSE = ["q", "piece", "annee", "marque", "modele", "niv"];
function estAdresseRecherche(url) {
  return MOTS_ADRESSE.some((m) => String(url).includes(`{${m}}`));
}

// Lien de recherche d'un site pour une pièce et un véhicule
function lienRecherche(site, piece, vehicule) {
  const pieceSeule = String(piece || "").trim();
  const q = [pieceSeule, texteVehicule(vehicule)].filter(Boolean).join(" ");
  if (!estAdresseRecherche(site.url)) {
    return `https://www.google.com/search?q=${encodeURIComponent(`site:${site.url} ${q}`)}`;
  }
  // Dans un chemin (catalogue RockAuto…), minuscules et « + » pour les espaces
  const chemin = (v) => encodeURIComponent(String(v || "").toLowerCase()).replace(/%20/g, "+");
  const valeurs = {
    q: encodeURIComponent(q),
    piece: encodeURIComponent(pieceSeule),
    annee: encodeURIComponent(vehicule?.annee || ""),
    marque: chemin(vehicule?.marque),
    modele: chemin(vehicule?.modele),
    niv: encodeURIComponent(vehicule?.niv || ""),
  };
  return site.url.replace(/\{(q|piece|annee|marque|modele|niv)\}/g, (_, m) => valeurs[m]);
}

// Une seule recherche Google chez tous les fournisseurs à la fois :
// « (site:napacanada.com OR site:rockauto.com) pièce véhicule ».
function lienRechercheTous(sites, piece, vehicule) {
  const q = [String(piece || "").trim(), texteVehicule(vehicule)].filter(Boolean).join(" ");
  const domaines = sites.map((s) => `site:${domaine(s.url)}`);
  if (domaines.length) {
    const filtre = domaines.length === 1 ? domaines[0] : `(${domaines.join(" OR ")})`;
    return `https://www.google.com/search?q=${encodeURIComponent(`${filtre} ${q}`)}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

module.exports = { CLE, SITES_DEFAUT, NB_MAX_SITES, lireSites, validerSites, domaine, texteVehicule, lienRecherche, lienRechercheTous };
