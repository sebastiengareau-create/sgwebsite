// Recherche de pièces sur le web, depuis un bon de travail : liens vers les
// sites des fournisseurs habituels (pré-remplis avec le véhicule du bon) et
// recherche poussée par l'IA (app/api/bons/[id]/recherche-pieces).
//
// Les sites sont réglés dans Paramètres → Sites de pièces (clé Parametre
// ci-dessous, en JSON). Chaque site a une adresse :
// - avec « {q} » : adresse de recherche du site, {q} remplacé par la
//   recherche (ex. https://www.exemple.ca/recherche?q={q}) ;
// - sans « {q} » : un domaine (ex. napacanada.com), cherché par Google
//   limité à ce site — marche pour n'importe quel fournisseur.
// Aucune dépendance serveur ici : le bon (navigateur) bâtit les liens.
const CLE = "recherche_pieces_sites";
const NB_MAX_SITES = 12;
const LONGUEUR_MAX_NOM = 40;
const LONGUEUR_MAX_URL = 300;

const SITES_DEFAUT = [
  { nom: "NAPA Canada", url: "napacanada.com" },
  { nom: "RockAuto", url: "rockauto.com" },
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
    if (url.includes("{q}")) {
      if (!/^https:\/\/[^\s]+$/i.test(url)) return { erreur: `Adresse de recherche invalide pour « ${nom} » : elle doit commencer par https://.` };
    } else if (!domaine(url)) {
      return { erreur: `Adresse invalide pour « ${nom} » : mets le domaine (ex. napacanada.com) ou une adresse de recherche avec {q}.` };
    }
    sites.push({ nom, url: url.includes("{q}") ? url : domaine(url) });
  }
  if (sites.length > NB_MAX_SITES) return { erreur: `${NB_MAX_SITES} sites maximum.` };
  return { sites };
}

// Texte du véhicule pour une recherche : « 2019 Honda Civic EX »
function texteVehicule(v) {
  return v ? [v.annee, v.marque, v.modele, v.version].filter(Boolean).join(" ") : "";
}

// Lien de recherche d'un site pour une pièce et un véhicule
function lienRecherche(site, piece, vehicule) {
  const q = [String(piece || "").trim(), texteVehicule(vehicule)].filter(Boolean).join(" ");
  if (site.url.includes("{q}")) return site.url.replaceAll("{q}", encodeURIComponent(q));
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${site.url} ${q}`)}`;
}

module.exports = { CLE, SITES_DEFAUT, NB_MAX_SITES, lireSites, validerSites, domaine, texteVehicule, lienRecherche };
