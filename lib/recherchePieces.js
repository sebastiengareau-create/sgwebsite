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
  { nom: "RockAuto", url: "https://www.rockauto.com/en/catalog/{marque},{annee},{modele}" },
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

// ---------- Résultat collé depuis le site d'un fournisseur ----------
// Lit le texte copié d'une fiche produit (nom, numéro de pièce, prix, lien)
// pour pré-remplir la ligne « à commander » — l'employé corrige au besoin.
// Un numéro peut commencer par un code de ligne (NAPA : « BK 7520 »).
const MOTIF_NUMERO = /(?:n[°ºo]\.?\s*(?:de\s+)?(?:pi[eè]ce|produit|article)|num[ée]ro\s+(?:de\s+)?(?:pi[eè]ce|produit|article)|part\s*(?:#|no\.?|number|num)|item\s*(?:#|no\.?)|sku|ugs|mpn|r[ée]f[ée]rence|r[ée]f\.?)\s*[:#.]?\s*((?:[A-Z]{2,4} )?[A-Z0-9][A-Z0-9\-\/.]{1,30}[A-Z0-9])/i;
const MOTIF_PRIX = /(?:\$\s*(\d{1,3}(?:[ \u00a0,]\d{3})*(?:[.,]\d{2})?)|(\d{1,3}(?:[ \u00a0]\d{3})*(?:[.,]\d{2}))\s*\$)/;
const MOTIF_LIEN = /https:\/\/[^\s<>"]+/;

function nombrePrix(brut) {
  let t = String(brut).replace(/[\s\u00a0]/g, "");
  // « 1,234.56 » (anglais) ou « 1234,56 » (français)
  if (/,\d{2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function lireResultatColle(texte) {
  const brut = String(texte || "").slice(0, 5000);
  const numero = brut.match(MOTIF_NUMERO)?.[1] || "";
  const prixTrouve = brut.match(MOTIF_PRIX);
  const prix = prixTrouve ? nombrePrix(prixTrouve[1] || prixTrouve[2]) : null;
  const lien = brut.match(MOTIF_LIEN)?.[0] || "";
  // Description : la première ligne qui n'est ni un prix, ni un numéro, ni
  // un lien, ni une mention de boutique (« Ajouter au panier »…)
  const description = brut
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length >= 4 && !MOTIF_PRIX.test(l) && !MOTIF_NUMERO.test(l) && !MOTIF_LIEN.test(l)
      && !/panier|cart|quantit|livraison|ramassage|en stock|in stock|disponib|magasin|store|^\d+$/i.test(l)) || "";
  return { description: description.slice(0, 150), numero, prix, lien };
}

// Champs d'une pièce de la liste « à commander » d'un bon (création ou modification) → { data } ou
// { erreur }. partiel : seuls les champs reçus sont validés.
function validerPieceACommander(corps, { partiel = false } = {}) {
  const data = {};
  if (!partiel || corps.description !== undefined) {
    const description = String(corps.description || "").trim();
    if (!description) return { erreur: "Indique la description de la pièce." };
    data.description = description.slice(0, 150);
  }
  for (const champ of ["numero", "fournisseur"]) {
    if (corps[champ] !== undefined) data[champ] = String(corps[champ] || "").trim().slice(0, 60) || null;
  }
  if (corps.lien !== undefined) {
    const lien = String(corps.lien || "").trim();
    if (lien && !/^https:\/\/\S+$/i.test(lien)) return { erreur: "Le lien doit commencer par https://." };
    data.lien = lien.slice(0, 500) || null;
  }
  if (corps.prix !== undefined) {
    if (corps.prix === null || corps.prix === "") data.prix = null;
    else {
      const prix = Number(String(corps.prix).replace(",", "."));
      if (!Number.isFinite(prix) || prix < 0) return { erreur: "Prix invalide." };
      data.prix = Math.round(prix * 100) / 100;
    }
  }
  if (corps.qte !== undefined) {
    const qte = Number(corps.qte);
    if (!Number.isInteger(qte) || qte < 1 || qte > 999) return { erreur: "Quantité invalide." };
    data.qte = qte;
  }
  if (corps.commandee !== undefined) data.commandee = corps.commandee === true;
  return { data };
}

module.exports = { CLE, SITES_DEFAUT, NB_MAX_SITES, lireSites, validerSites, domaine, texteVehicule, lienRecherche, lienRechercheTous, lireResultatColle, validerPieceACommander };
