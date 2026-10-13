// Recherche de pièces sur le web, depuis un bon de travail ou une commande
// de pièces en brouillon : une recherche chez tous les fournisseurs
// habituels à la fois, et un lien par fournisseur, pré-remplis avec la pièce
// (et le véhicule du bon, s'il y en a un).
//
// Les sites sont réglés dans Paramètres → Sites de pièces (clé Parametre
// ci-dessous, en JSON). Chaque site a une adresse :
// - avec des mots entre accolades : adresse de recherche du site, ouverte
//   directement. {q} = pièce + véhicule, {piece} = pièce seule, {annee},
//   {marque}, {modele}, {niv} (ex. https://www.exemple.ca/recherche?q={q}) ;
// - une adresse complète sans accolades (ex. la page de connexion d'un
//   portail comme NAPA ProLink) : lien direct, ouvert tel quel — la pièce
//   est copiée pour la coller dans le site ;
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

// Sites connus dont l'adresse dépend de ce qu'on sait : RockAuto n'a pas de
// recherche par mots — son catalogue s'ouvre sur un véhicule, sinon sa
// recherche par numéro de pièce. Vaut aussi pour un site réglé par son
// domaine seul (« rockauto.com », ancien réglage par défaut).
const ADRESSES_CONNUES = {
  "rockauto.com": {
    vehicule: "https://www.rockauto.com/en/catalog/{marque},{annee},{modele}",
    piece: "https://www.rockauto.com/en/partsearch/?partnum={piece}",
  },
};

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
    let url = String(s?.url || "").trim();
    if (!nom && !url) continue;
    if (!nom) return { erreur: "Indique le nom de chaque site." };
    if (nom.length > LONGUEUR_MAX_NOM) return { erreur: `Nom trop long : « ${nom} » (${LONGUEUR_MAX_NOM} caractères maximum).` };
    if (url.length > LONGUEUR_MAX_URL) return { erreur: `Adresse trop longue pour « ${nom} ».` };
    // Adresse de résultats collée telle quelle (recherche de « test ») :
    // « test » devient {piece}. Une adresse de recherche sans mot à
    // remplacer serait sinon réduite à son domaine, donc cherchée par Google.
    if (!estAdresseRecherche(url) && /^https?:\/\//i.test(url)) url = remplacerTest(url);
    if (estAdresseRecherche(url) || estLienDirect(url)) {
      if (!/^https:\/\/[^\s]+$/i.test(url)) return { erreur: `Adresse invalide pour « ${nom} » : elle doit commencer par https://.` };
    } else if (!domaine(url)) {
      return { erreur: `Adresse invalide pour « ${nom} » : mets le domaine (ex. exemple.ca) ou une adresse de recherche avec {q}.` };
    }
    sites.push({ nom, url: estAdresseRecherche(url) || estLienDirect(url) ? url : domaine(url) });
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

// Adresse complète avec un chemin ou des paramètres, sans accolades : ouverte
// telle quelle (« https://exemple.ca/connexion »). Le domaine seul, avec ou
// sans https://, reste une recherche Google limitée au site.
function estLienDirect(url) {
  const u = String(url || "").trim();
  return /^https?:\/\//i.test(u) && !estAdresseRecherche(u) && /^https?:\/\/[^/?#]+[/?#;].+/i.test(u.replace(/\/+$/, ""));
}

// « …?q=Test&page=1 » → « …?q={piece}&page=1 » ; aussi dans un chemin
// (« …/search/test ») ou un paramètre « ;search=test ». Le numéro de
// session que certains sites ajoutent (ssid, sessionid…) est retiré.
function remplacerTest(url) {
  return url
    .replace(/([=/])test(?=$|[&;/?#])/gi, "$1{piece}")
    .replace(/[&;](?:ssid|sessionid|sid)=[^&;#]*/gi, "")
    .replace(/\?(?:ssid|sessionid|sid)=[^&;#]*&?/i, "?");
}

// Lien de recherche d'un site pour une pièce et un véhicule (facultatif).
// Une adresse qui ne cherche que le véhicule passe par Google, limité au
// site, quand le véhicule n'en donne pas le détail (aucun véhicule depuis
// une commande) — sauf un site connu qui a une autre recherche (RockAuto :
// par numéro de pièce, voir ADRESSES_CONNUES).
function lienRecherche(site, piece, vehicule) {
  const pieceSeule = String(piece || "").trim();
  const q = [pieceSeule, texteVehicule(vehicule)].filter(Boolean).join(" ");
  const vehiculeIncomplet = (url) => !/\{(q|piece)\}/.test(url)
    && ["annee", "marque", "modele", "niv"].some((m) => url.includes(`{${m}}`) && !vehicule?.[m]);
  let url = site.url;
  if (estLienDirect(url)) return url;
  const connue = ADRESSES_CONNUES[domaine(url)];
  if (connue && (!estAdresseRecherche(url) || vehiculeIncomplet(url))) {
    if (!vehiculeIncomplet(connue.vehicule)) url = connue.vehicule;
    else if (pieceSeule) url = connue.piece;
  }
  if (!estAdresseRecherche(url) || vehiculeIncomplet(url)) {
    const d = domaine(url);
    return `https://www.google.com/search?q=${encodeURIComponent(d ? `site:${d} ${q}` : q)}`;
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
  return url.replace(/\{(q|piece|annee|marque|modele|niv)\}/g, (_, m) => valeurs[m]);
}

// Une seule recherche Google chez tous les fournisseurs à la fois :
// « (site:napacanada.com OR site:rockauto.com) pièce véhicule ».
function lienRechercheTous(sites, piece, vehicule) {
  const q = [String(piece || "").trim(), texteVehicule(vehicule)].filter(Boolean).join(" ");
  // Un lien direct (portail avec connexion) n'est pas indexé par Google
  const domaines = [...new Set(sites.filter((s) => !estLienDirect(s.url)).map((s) => domaine(s.url)))].map((d) => `site:${d}`);
  if (domaines.length) {
    const filtre = domaines.length === 1 ? domaines[0] : `(${domaines.join(" OR ")})`;
    return `https://www.google.com/search?q=${encodeURIComponent(`${filtre} ${q}`)}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

// ---------- Résultat collé depuis le site d'un fournisseur ----------
// Lit le texte copié d'une fiche produit ou d'une ligne de catalogue (nom,
// numéro de pièce, prix, lien) pour pré-remplir la ligne — l'employé corrige
// au besoin. Le texte est lu ligne par ligne (les tabulations d'un tableau
// copié, RockAuto, comptent comme des lignes).

// Libellés du numéro : « N° de pièce », « Part # », « UGS »…
const LIBELLE_NUMERO = String.raw`(?:n[°ºo]\.?\s*(?:de\s+)?(?:pi[eè]ce|produit|article)|(?:pi[eè]ce|article|produit)\s*n[°ºo]\.?|num[ée]ro\s+(?:de\s+)?(?:pi[eè]ce|produit|article)|(?:mfr\.?\s*|manufacturer\s*)?part\s*(?:#|no\.?|number|num)|(?:item|product|model)\s*(?:#|no\.?|number)|sku|ugs|mpn|r[ée]f[ée]rence|r[ée]f\.?)`;
// Un numéro peut commencer par un code de ligne (NAPA : « BK 7520 »)
const VALEUR_NUMERO = String.raw`((?:[A-Z]{2,4} )?[A-Z0-9][A-Z0-9\-\/.]{0,30}[A-Z0-9])`;
const MOTIF_NUMERO = new RegExp(`${LIBELLE_NUMERO}\\s*[:#.]?\\s*${VALEUR_NUMERO}`, "i");
const MOTIF_LIBELLE_NUMERO_SEUL = new RegExp(`^${LIBELLE_NUMERO}\\s*[:#.]?$`, "i");
// Numéro sans libellé (ligne de catalogue) : un seul « mot » avec au moins
// un chiffre — « FL910S », « 51348 », « BK 7520 »
const MOTIF_CODE_SEUL = /^(?:[A-Z]{2,4} )?(?=[A-Z0-9\-\/.]*\d)[A-Z0-9][A-Z0-9\-\/.]{2,24}$/i;

// Prix : « $12.49 », « 12,49 $ », « CA$ 1 249,95 », « 1,249.95 $ »
const NOMBRE_SEPARE = String.raw`\d{1,3}(?:[   ,]\d{3})+(?:[.,]\d{2})?`;
const MOTIF_PRIX_GLOBAL = new RegExp(
  String.raw`(?:(?:CA|C|US)?\$|CAD)\s*(${NOMBRE_SEPARE}|\d+(?:[.,]\d{2})?)|(${NOMBRE_SEPARE}|\d+(?:[.,]\d{2})?)\s*(?:\$|CAD\b)`,
  "gi"
);
const MOTIF_PRIX = new RegExp(MOTIF_PRIX_GLOBAL.source, "i");
// Prix à écarter (prix barré, consigne, livraison…) et prix voulus
const PRIX_ECARTE = /r[ée]gulier|\blist|\bwas\b|msrp|pdsf|d[ée]tail|\bcore\b|consigne|d[ée]p[ôo]t|[ée]conomi|\bsave|livraison|shipping|frais|taxe|\btax|total|rabais|discount/i;
const PRIX_VOULU = /votre prix|your price|\bnow\b|maintenant|vente|sale|sp[ée]cial|aubaine|\bnet\b|\bprix\b|price|co[ûu]t|cost/i;
const MOTIF_LIBELLE_PRIX_SEUL = /^(?:votre\s+)?(?:prix|price|your price|co[ûu]t|cost)\s*:?$/i;
const MOTIF_LIEN = /https:\/\/[^\s<>"]+/;

// Lignes qui ne décrivent pas la pièce : boutique, avis, caractéristiques…
const LIGNE_BOUTIQUE = /panier|\bcart\b|quantit|\bqt[ée]\b|\bqty\b|livraison|shipping|ramassage|pick ?up|stock|disponib|availab|magasin|\bstore\b|\bavis\b|review|[★☆]|^info$|^voir|^view|compar|ajouter|\badd\b|garantie|warranty|^(?:ligne|line|marque|brand|fabricant|manufacturer|cat[ée]gorie|category)\s*:|^(?:pdsf|msrp|consigne|core)\b|connexion|sign in|^accueil|^home$/i;
const LIBELLE_DESCRIPTION = /^(?:description|nom|name|produit|product|titre|title)\s*:\s*/i;
const MOTIF_MARQUE_LIBELLEE = /^(?:marque|brand|fabricant|manufacturer)\s*:\s*(.+)$/i;

function nombrePrix(brut) {
  let t = String(brut).replace(/[\s  ]/g, "");
  // « 1,234.56 » (anglais) ou « 1234,56 » (français)
  if (/,\d{2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function lireNumero(lignes) {
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(MOTIF_NUMERO);
    if (m) return { numero: m[1], ligne: i };
    // Libellé seul, valeur sur la ligne suivante (cellules d'un tableau)
    if (MOTIF_LIBELLE_NUMERO_SEUL.test(lignes[i]) && MOTIF_CODE_SEUL.test(lignes[i + 1] || "")) return { numero: lignes[i + 1], ligne: i + 1 };
  }
  const i = lignes.findIndex((l) => MOTIF_CODE_SEUL.test(l) && !MOTIF_PRIX.test(l) && !/^(?:19|20)\d{2}$/.test(l) && !/^\d{1,3}$/.test(l));
  return i >= 0 ? { numero: lignes[i], ligne: i } : { numero: "", ligne: -1 };
}

// Le prix voulu : un prix libellé comme tel (« Votre prix », « Now »), sinon
// le premier qui n'est ni barré, ni une consigne, ni des frais ; jamais 0 $.
// Le contexte d'un prix : le texte qui le précède sur sa ligne, ou la ligne
// d'avant quand il est seul (« Prix » / « 42,19 $ »).
function lirePrix(lignes) {
  const trouves = [];
  lignes.forEach((ligne, i) => {
    let debut = 0;
    for (const m of ligne.matchAll(MOTIF_PRIX_GLOBAL)) {
      const prix = nombrePrix(m[1] || m[2]);
      let contexte = ligne.slice(debut, m.index).trim();
      debut = m.index + m[0].length;
      const precedente = lignes[i - 1] || "";
      if (!contexte && precedente.length <= 30 && !MOTIF_PRIX.test(precedente)) contexte = precedente;
      // « 11,29 $ ch. » : la fin de ligne compte aussi pour écarter un prix
      const suite = ligne.slice(debut).split(MOTIF_PRIX)[0] || "";
      if (prix != null) trouves.push({ prix, contexte, ecarte: PRIX_ECARTE.test(contexte) || PRIX_ECARTE.test(suite) });
    }
  });
  const gardes = trouves.filter((t) => !t.ecarte);
  return (gardes.find((t) => PRIX_VOULU.test(t.contexte)) || gardes[0] || trouves[0])?.prix ?? null;
}

function lireDescription(lignes, numero, ligneNumero) {
  let marque = "";
  let description = "";
  for (let i = 0; i < lignes.length && !description; i++) {
    const brute = lignes[i];
    const marqueLibellee = brute.match(MOTIF_MARQUE_LIBELLEE);
    if (marqueLibellee) { marque ||= marqueLibellee[1].trim(); continue; }
    const l = brute.replace(LIBELLE_DESCRIPTION, "").trim();
    if (i === ligneNumero || (numero && l.toLowerCase() === numero.toLowerCase())) continue;
    if (MOTIF_PRIX.test(l) || MOTIF_NUMERO.test(l) || MOTIF_LIEN.test(l) || MOTIF_LIBELLE_NUMERO_SEUL.test(l) || MOTIF_LIBELLE_PRIX_SEUL.test(l)) continue;
    if (LIGNE_BOUTIQUE.test(l) || /^[\d\s.,/-]+$/.test(l)) continue;
    // Fil d'Ariane : « Accueil / Freins / Plaquettes »
    if ((l.match(/\s[/>›»|]\s/g) || []).length >= 2) continue;
    // Marque seule en majuscules (RockAuto : « WIX », « MOTORCRAFT »)
    if (/^[A-Z][A-Z&.\-]{1,19}$/.test(l)) { marque ||= l; continue; }
    if (l.length >= 3 && /[a-zà-ÿ]{2}/i.test(l)) description = l;
  }
  // Rien de mieux (tout sur une ligne : « Filtre à huile WIX 51348 — 12,49 $ ») :
  // la première ligne, sans prix ni numéro libellé
  if (!description && !marque && lignes.length) {
    const reste = lignes[0].replace(MOTIF_PRIX_GLOBAL, " ").replace(MOTIF_NUMERO, " ").replace(/[\s\-–—:|,;]+$/, "").replace(/\s+/g, " ").trim();
    if (/[a-zà-ÿ]{2}/i.test(reste) && !PRIX_ECARTE.test(reste) && !LIGNE_BOUTIQUE.test(reste)) description = reste;
  }
  if (description && marque && !description.toLowerCase().includes(marque.toLowerCase())) description = `${marque} ${description}`;
  return description || marque;
}

// Tableau copié (site d'un grossiste) : une ligne d'en-têtes séparés par des
// tabulations (« Numéro de Produit », « Concessionnaire ($) », « Détail ($) »…),
// puis les valeurs, dans le même ordre. Prix : celui qu'on paie
// (concessionnaire, coûtant, net…), jamais le prix de détail.
const ENTETE_DESCRIPTION = /^(?:description|nom|name|produit|product|titre|title|article)\b(?!.*(?:#|n[°ºo]|num|no\.))/i;
const ENTETE_PRIX = /\(\$\)|\$|prix|price|co[ûu]t|cost|concessionnaire|dealer|marchand|net\b|jobber|wholesale/i;
const ENTETE_PRIX_PAYE = /concessionnaire|dealer|marchand|co[ûu]t|cost|net\b|jobber|wholesale|votre|your/i;
const ENTETE_PRIX_ECARTE = /d[ée]tail|retail|list|msrp|pdsf|core|consigne|r[ée]gulier/i;

function lireTableau(brut) {
  const lignesBrutes = brut.split(/\r?\n/);
  const iEntete = lignesBrutes.findIndex((l) => {
    const cellules = l.split("\t").map((c) => c.trim()).filter(Boolean);
    return cellules.length >= 3 && cellules.some((c) => MOTIF_LIBELLE_NUMERO_SEUL.test(c) || ENTETE_PRIX.test(c))
      && !cellules.some((c) => MOTIF_PRIX.test(c));
  });
  if (iEntete < 0) return null;
  const entetes = lignesBrutes[iEntete].split("\t").map((c) => c.trim());
  while (entetes.length && !entetes[entetes.length - 1]) entetes.pop();
  const valeurs = lignesBrutes.slice(iEntete + 1).join("\n").split(/\t|\r?\n/).map((c) => c.replace(/\s+/g, " ").trim());
  const colonnes = entetes.map((entete, i) => ({ entete, valeur: valeurs[i] || "" }));

  const numero = colonnes.find((c) => MOTIF_LIBELLE_NUMERO_SEUL.test(c.entete) && c.valeur)?.valeur.match(new RegExp(`^${VALEUR_NUMERO}`, "i"))?.[1] || "";
  const description = colonnes.find((c) => ENTETE_DESCRIPTION.test(c.entete) && c.valeur)?.valeur || "";
  const prixDe = (c) => nombrePrix(c.valeur.match(/\d[\d\s\u00a0,.]*\d|\d/)?.[0] || "");
  const prixPossibles = colonnes.filter((c) => ENTETE_PRIX.test(c.entete) && !ENTETE_PRIX_ECARTE.test(c.entete) && prixDe(c) != null);
  const colPrix = prixPossibles.find((c) => ENTETE_PRIX_PAYE.test(c.entete)) || prixPossibles[0];
  // Ce qui précède le tableau (le titre du produit, copié avec lui) et ce qui
  // le suit (« Ajouter au panier »…), pour la description quand le tableau
  // n'en a pas
  const avant = lignesBrutes.slice(0, iEntete).join("\t").split("\t");
  const reste = [...avant, ...valeurs.slice(entetes.length)].map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean);
  return { numero, description, prix: colPrix ? prixDe(colPrix) : null, reste };
}

function lireResultatColle(texte) {
  const brut = String(texte || "").slice(0, 5000);
  const lien = brut.match(MOTIF_LIEN)?.[0] || "";
  const tableau = lireTableau(brut);
  if (tableau) {
    return {
      description: (tableau.description || lireDescription(tableau.reste, tableau.numero, -1)).slice(0, 150),
      numero: tableau.numero.slice(0, 60),
      prix: tableau.prix,
      lien,
    };
  }
  const lignes = brut.split(/\r?\n|\t/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const { numero, ligne } = lireNumero(lignes);
  return {
    description: lireDescription(lignes, numero, ligne).slice(0, 150),
    numero: numero.slice(0, 60),
    prix: lirePrix(lignes),
    lien,
  };
}

// ---------- Rapprochement avec l'inventaire ----------
// Fiche d'inventaire qui porte déjà ce numéro (même ordre que le serveur,
// lib/brouillonsCommande.js) : chez ce fournisseur, puis le numéro de la
// pièce ou un de ses autres numéros, puis chez un autre fournisseur.
// inventaire : pièces avec leurs fournisseurs ({ fournisseurId, numeroFournisseur }).
function pieceExistante(numero, fournisseurId, inventaire) {
  const n = String(numero || "").trim().toLowerCase();
  if (!n) return null;
  return inventaire.find((p) => p.fournisseurs?.some((f) => f.fournisseurId === fournisseurId && f.numeroFournisseur?.toLowerCase() === n))
    || inventaire.find((p) => p.numero.toLowerCase() === n || p.autresNumeros?.includes(String(numero).trim()))
    || inventaire.find((p) => p.fournisseurs?.some((f) => f.numeroFournisseur?.toLowerCase() === n))
    || null;
}

// Fournisseur proposé pour un site : celui dont le nom ressemble
// (« NAPA Canada » → « NAPA Pièces d'auto »), sinon aucun
function fournisseurPropose(nom, fournisseurs) {
  const mots = String(nom || "").toLowerCase().split(/[^a-z0-9àâçéèêëîïôûùüÿ]+/).filter((m) => m.length >= 3);
  return fournisseurs.find((f) => mots.some((m) => f.nom.toLowerCase().includes(m)))?.id || "";
}

// Prix de vente proposé à partir du coûtant (marge du profil client,
// lib/client.js) : « » si aucune marge ou aucun coûtant
function prixVentePropose(cout, marge) {
  const c = Number(String(cout ?? "").replace(",", "."));
  return marge != null && cout !== "" && cout != null && Number.isFinite(c) && c >= 0 ? (c / (1 - marge / 100)).toFixed(2) : "";
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

module.exports = { CLE, SITES_DEFAUT, NB_MAX_SITES, lireSites, validerSites, domaine, estLienDirect, texteVehicule, lienRecherche, lienRechercheTous, lireResultatColle, validerPieceACommander, pieceExistante, fournisseurPropose, prixVentePropose };
