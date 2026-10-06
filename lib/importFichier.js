const ExcelJS = require("exceljs");
const { Readable } = require("stream");
const {
  codeProvince, normaliserProvince, normaliserCodePostal, decouperAdresse, decouperVille, MOTIF_CODE_POSTAL,
} = require("./adresse");
const { cleVille, trouverMunicipalite, separerVilleEnFin } = require("./municipalitesQuebec");

const RE_VIRGULE_NUMERO_CIVIQUE = new RegExp(
  "(^|,)(\\s*\\d{1,6}[a-z]?(?:-\\d+[a-z]?)?),(\\s*(?:rue|av|ave|avenue|boul|boulevard|bd|blvd|chemin|ch|route|rte|rang|mont[ée]e|place|pl|croissant|impasse|all[ée]e|terrasse|promenade|carr[ée]|square|street|road|rd|drive|dr)\\b)",
  "gim"
);

// Lit un fichier .xlsx/.xls/.csv uploadé (objet File du FormData) et
// retourne sa première feuille. Détecte le délimiteur CSV réel plutôt que
// de supposer une virgule — les exports Excel en français utilisent
// souvent ";" (la virgule sert de séparateur décimal dans ce format).
async function lireFeuille(fichier) {
  const octets = Buffer.from(await fichier.arrayBuffer());
  const classeur = new ExcelJS.Workbook();

  if (fichier.name?.toLowerCase().endsWith(".csv")) {
    let texte = octets.toString("utf-8");
    const premiereLigne = texte.split(/\r?\n/, 1)[0] || "";
    const delimiter = (premiereLigne.match(/;/g) || []).length > (premiereLigne.match(/,/g) || []).length ? ";" : ",";
    // « 123, rue Principale » sans guillemets dans un CSV à virgules : la
    // virgule après le numéro civique décalerait toutes les colonnes.
    if (delimiter === ",") texte = texte.replace(RE_VIRGULE_NUMERO_CIVIQUE, (_, debut, numero, rue) => `${debut}${numero} ${rue.trim()}`);
    await classeur.csv.read(Readable.from(Buffer.from(texte, "utf-8")), { parserOptions: { delimiter } });
  } else {
    await classeur.xlsx.load(octets);
  }

  return classeur.worksheets[0];
}

function normaliserEntete(texte) {
  return String(texte || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // retire les accents
    .toLowerCase().trim().replace(/\s+/g, " ");
}

// Associe chaque colonne de la ligne d'en-têtes à un champ connu, via une
// liste d'alias par champ (comparés sans accents/casse) — accepte les
// en-têtes tels quels dans le fichier du client (ex. "Téléphone", "Tel").
function mapperEntetes(ligneEntetes, aliasParChamp) {
  const mappage = {}; // index de colonne (1-based, ExcelJS) → nom de champ
  ligneEntetes.eachCell((cell, colNumber) => {
    const entete = normaliserEntete(cell.value);
    for (const [champ, alias] of Object.entries(aliasParChamp)) {
      if (alias.includes(entete)) {
        mappage[colNumber] = champ;
        break;
      }
    }
  });
  return mappage;
}

function valeurCellule(cell) {
  if (cell == null) return "";
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim(); // texte enrichi
  if (typeof v === "object" && v.text) return String(v.text).trim(); // lien (courriel, site…)
  if (typeof v === "object" && v.result !== undefined) return String(v.result).trim(); // formule
  return String(v).trim();
}

// Relit une ligne de la feuille en un objet { champ: valeurTexte } selon le
// mappage de colonnes — utilitaire commun aux différentes routes d'import.
function lireLigne(ligne, mappage) {
  const donnees = {};
  for (const [colNumber, champ] of Object.entries(mappage)) {
    donnees[champ] = valeurCellule(ligne.getCell(Number(colNumber)));
  }
  return donnees;
}

// ─── Import « intelligent » des coordonnées (clients, fournisseurs) ───────
//
// Les fichiers des clients arrivent de partout (autre logiciel, Excel fait
// à la main, export Outlook…) : en-têtes pas sur la 1re ligne, intitulés
// libres (« No. de tél. », « Adresse de facturation »), prénom et nom
// séparés, adresse complète dans une seule case, colonnes sans en-tête…
// analyserFeuille() trouve la ligne d'en-têtes et associe chaque colonne au
// bon champ — par son intitulé, sinon par son contenu — puis
// nettoyerCoordonnees() remet chaque valeur dans la bonne case.

const motsEntete = (texte) => normaliserEntete(texte).replace(/[^a-z0-9]+/g, " ").trim();

const RE_COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const chiffres = (t) => String(t || "").replace(/\D/g, "");
const estCourriel = (t) => RE_COURRIEL.test(String(t || "").trim());
const estTelephone = (t) => {
  const brut = String(t || "").trim();
  const n = chiffres(brut).length;
  return n >= 10 && n <= 15 && /^[\d\s().+\-#xposte]+$/i.test(brut);
};
const estCodePostal = (t) => /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i.test(String(t || "").trim());
const estAdresseRue = (t) => /^\d+[a-z]?(-\d+)?[\s,]+\S+/i.test(String(t || "").trim()) && /[a-z]{3,}/i.test(String(t || ""));

// Reconnaissance d'une colonne par son contenu, quand l'en-tête ne dit rien
const DETECTEURS = {
  courriel: estCourriel,
  telephone: estTelephone,
  codePostal: estCodePostal,
  province: (t) => !!codeProvince(t),
  ville: (t) => !!trouverMunicipalite(t),
  adresse: estAdresseRue,
};

// Score d'un intitulé pour un champ : correspondance exacte d'un alias (le
// plus fort), sinon tous les mots d'un alias présents dans l'intitulé
// (« Téléphone principal », « Adresse de facturation »).
function scoreEntete(entete, alias) {
  if (!entete) return 0;
  let meilleur = 0;
  const motsColonne = new Set(entete.split(" "));
  for (const a of alias) {
    const aliasMots = motsEntete(a);
    if (!aliasMots) continue;
    if (aliasMots === entete || aliasMots.replace(/ /g, "") === entete.replace(/ /g, "")) {
      meilleur = Math.max(meilleur, 1000 + aliasMots.length);
      continue;
    }
    const mots = aliasMots.split(" ");
    // Un mot très court (« no », « tel ») seul ne suffit pas hors correspondance exacte
    if (mots.length === 1 && mots[0].length < 3) continue;
    if (mots.every((m) => motsColonne.has(m))) meilleur = Math.max(meilleur, aliasMots.length);
  }
  return meilleur;
}

// Associe les colonnes d'une ligne d'en-têtes aux champs ; une colonne va à
// un seul champ (le mieux noté), un champ peut recevoir plusieurs colonnes
// (ex. « Téléphone » et « Cellulaire » : la 1re non vide l'emporte).
function associerEntetes(ligne, aliasParChamp) {
  const candidats = [];
  ligne.eachCell((cell, col) => {
    const texte = valeurCellule(cell);
    // Une donnée (courriel, téléphone, adresse…) n'est pas un intitulé
    if (texte.length > 40 || Object.values(DETECTEURS).some((test) => test(texte)) || MOTIF_CODE_POSTAL.test(texte)) return;
    const entete = motsEntete(texte);
    for (const [champ, alias] of Object.entries(aliasParChamp)) {
      const score = scoreEntete(entete, alias);
      if (score > 0) candidats.push({ col, champ, score });
    }
  });
  candidats.sort((a, b) => b.score - a.score || a.col - b.col);
  const colonnes = {}; // col → { champ, score }
  for (const c of candidats) if (!colonnes[c.col]) colonnes[c.col] = c;
  return colonnes;
}

// Analyse la feuille : ligne d'en-têtes (parmi les 10 premières — la
// meilleure), colonnes reconnues par intitulé, puis colonnes restantes
// reconnues par leur contenu. Retourne { premiereLigne, lire(ligne),
// champs, detectees } ; lire() donne { champ: valeur } pour une ligne.
function analyserFeuille(feuille, aliasParChamp, { champPrincipal = "nom" } = {}) {
  let ligneEntetes = 0;
  let colonnes = {};
  const derniereRecherche = Math.min(10, feuille.rowCount);
  for (let n = 1; n <= derniereRecherche; n++) {
    const essai = associerEntetes(feuille.getRow(n), aliasParChamp);
    const nb = Object.keys(essai).length;
    const nbActuel = Object.keys(colonnes).length;
    const aPrincipal = Object.values(essai).some((c) => c.champ === champPrincipal);
    const actuelAPrincipal = Object.values(colonnes).some((c) => c.champ === champPrincipal);
    if (nb > 0 && (aPrincipal && !actuelAPrincipal || (aPrincipal === actuelAPrincipal && nb > nbActuel))) {
      ligneEntetes = n;
      colonnes = essai;
    }
  }
  const premiereLigne = ligneEntetes + 1;

  // Colonnes sans intitulé reconnu : on regarde ce qu'elles contiennent
  const champsPris = new Set(Object.values(colonnes).map((c) => c.champ));
  const echantillon = [];
  for (let n = premiereLigne; n <= feuille.rowCount && echantillon.length < 50; n++) {
    const l = feuille.getRow(n);
    if (l.hasValues) echantillon.push(l);
  }
  const nbColonnes = Math.max(feuille.columnCount || 0, ...echantillon.map((l) => l.cellCount || 0));
  const detectees = [];
  const colonnesTexteLibre = [];
  for (let col = 1; col <= nbColonnes; col++) {
    if (colonnes[col]) continue;
    const valeurs = echantillon.map((l) => valeurCellule(l.getCell(col))).filter(Boolean);
    if (valeurs.length === 0) continue;
    // En-tête présent mais inconnu (« Notes », « Solde »…) : on n'y touche pas
    if (ligneEntetes && valeurCellule(feuille.getRow(ligneEntetes).getCell(col))) continue;
    let trouve = null;
    for (const [champ, test] of Object.entries(DETECTEURS)) {
      if (!aliasParChamp[champ] || champsPris.has(champ)) continue;
      if (valeurs.filter(test).length / valeurs.length >= 0.6) { trouve = champ; break; }
    }
    if (trouve) {
      colonnes[col] = { champ: trouve, score: 0 };
      champsPris.add(trouve);
      detectees.push(trouve);
    } else if (valeurs.filter((v) => /[a-z]/i.test(v)).length / valeurs.length >= 0.6) {
      colonnesTexteLibre.push(col);
    }
  }
  // Pas de colonne « Nom » : la 1re colonne de texte non reconnue fait l'affaire
  if (!champsPris.has(champPrincipal) && colonnesTexteLibre.length > 0) {
    colonnes[colonnesTexteLibre[0]] = { champ: champPrincipal, score: 0 };
    champsPris.add(champPrincipal);
    detectees.push(champPrincipal);
  }

  // Ordre de lecture : intitulé exact avant intitulé approchant, puis gauche → droite
  const ordre = Object.entries(colonnes)
    .map(([col, c]) => ({ col: Number(col), ...c }))
    .sort((a, b) => b.score - a.score || a.col - b.col);

  function lire(ligne) {
    const donnees = {};
    for (const { col, champ } of ordre) {
      if (donnees[champ]) continue;
      const v = valeurCellule(ligne.getCell(col));
      if (v) donnees[champ] = v;
    }
    return donnees;
  }

  return { premiereLigne, lire, champs: champsPris, detectees };
}

// Alias d'en-têtes communs aux clients et fournisseurs (comparés sans
// accents, casse ni ponctuation).
const ALIAS_COORDONNEES = {
  prenom: ["prenom", "first name", "firstname", "given name"],
  telephone: [
    "telephone", "tel", "tel 1", "telephone 1", "phone", "phone 1", "no telephone", "numero telephone", "numero de telephone",
    "telephone principal", "telephone bureau", "tel bureau", "tel maison", "tel domicile", "tel cell", "telephone maison", "telephone domicile", "business phone", "home phone",
    "primary phone", "cell", "cellulaire", "mobile", "mobile phone", "portable", "telephone 2", "phone 2", "tel 2",
  ],
  courriel: ["courriel", "email", "e mail", "mail", "adresse courriel", "courriel electronique", "adresse electronique", "e mail address", "email address"],
  adresse: [
    "adresse", "address", "rue", "street", "adresse 1", "address 1", "adresse ligne 1", "address line 1",
    "adresse civique", "adresse postale", "adresse de facturation", "billing address", "street address", "no civique",
  ],
  adresse2: ["adresse 2", "address 2", "adresse ligne 2", "address line 2", "appartement", "app", "apt", "suite", "unite"],
  ville: ["ville", "city", "municipalite", "localite", "town", "ville de facturation", "billing city"],
  province: ["province", "prov", "etat", "state", "province etat", "state province", "billing state"],
  codePostal: ["codepostal", "code postal", "postal", "cp", "zip", "zipcode", "zip code", "postal code", "code zip", "billing postal code"],
  pays: ["pays", "country"],
  telecopieur: ["telecopieur", "fax", "telecopie", "no fax"], // reconnu pour ne pas le prendre pour le téléphone
};

const contientCodePostal = (t) => MOTIF_CODE_POSTAL.test(String(t || ""));

// Format uniforme des numéros nord-américains : 5145551234 → 514-555-1234
function formaterTelephone(texte) {
  const brut = String(texte || "").trim();
  if (!brut) return null;
  let n = chiffres(brut);
  if (n.length === 11 && n.startsWith("1")) n = n.slice(1);
  if (n.length === 10 && /^[\d\s().+\-]+$/.test(brut)) return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
  return brut;
}

// Remet les coordonnées d'une ligne lue dans les bonnes cases :
// prénom + nom, courriel/téléphone inversés, adresse complète dans une
// seule case, ville « Laval, QC », province écrite en toutes lettres, code
// postal sans espace… Ne remplit jamais une case déjà remplie par le fichier.
function nettoyerCoordonnees(brut) {
  const d = { ...brut };
  const vide = (champ) => !d[champ];

  if (d.prenom && d.nom && !d.nom.toLowerCase().includes(d.prenom.toLowerCase())) d.nom = `${d.prenom} ${d.nom}`;
  else if (d.prenom && !d.nom) d.nom = d.prenom;

  // Courriel et téléphone dans la mauvaise colonne
  if (d.telephone && estCourriel(d.telephone) && vide("courriel")) { d.courriel = d.telephone; d.telephone = ""; }
  if (d.courriel && !estCourriel(d.courriel) && estTelephone(d.courriel) && vide("telephone")) { d.telephone = d.courriel; d.courriel = ""; }

  // Code postal ou province égarés dans la colonne de l'autre (« QC H1A 1A1 »)
  for (const champ of ["province", "ville", "codePostal"]) {
    if (!d[champ] || estCodePostal(d[champ])) continue;
    const m = String(d[champ]).match(MOTIF_CODE_POSTAL);
    if (m) {
      if (vide("codePostal") || champ === "codePostal") d.codePostal = `${m[1]} ${m[2]}`;
      if (champ !== "codePostal") d[champ] = String(d[champ]).replace(m[0], "").replace(/[\s,]+$/, "").trim();
      else {
        const reste = String(brut.codePostal).replace(m[0], "").replace(/[\s,]+/g, " ").trim();
        if (reste && codeProvince(reste) && vide("province")) d.province = reste;
      }
    }
  }

  // Rue dans la colonne Ville et ville dans la colonne Adresse : on inverse
  if (d.ville && estAdresseRue(d.ville) && !trouverMunicipalite(d.ville) && (vide("adresse") || trouverMunicipalite(d.adresse))) {
    [d.adresse, d.ville] = [d.ville, d.adresse || ""];
  }

  // Ville accompagnée de la province (« Laval, QC », « Lévis (Québec) »)
  if (d.ville) {
    const v = decouperVille(d.ville);
    if (v.ville) d.ville = v.ville;
    if (v.province && vide("province")) d.province = v.province;
  }

  // Adresse complète dans une seule case : on la découpe. La virgule après
  // le numéro civique (« 123, rue Principale ») ne sépare rien, et une
  // municipalité du Québec est reconnue même sans virgule devant.
  if (d.adresse && (contientCodePostal(d.adresse) || vide("ville") || d.adresse.includes(","))) {
    const morceaux = decouperAdresse(d.adresse, { separerVilleEnFin, estVille: trouverMunicipalite });
    if (morceaux.ville || morceaux.province || morceaux.codePostal) {
      // Ville déjà fournie par le fichier et différente : ce segment fait
      // partie de l'adresse (« secteur », nom de domaine…), on le laisse.
      const autreVille = morceaux.ville && d.ville && cleVille(morceaux.ville) !== cleVille(d.ville);
      d.adresse = (autreVille ? [morceaux.adresse, morceaux.ville].filter(Boolean).join(", ") : morceaux.adresse) || "";
      if (autreVille) morceaux.ville = null;
      for (const champ of ["ville", "province", "codePostal"]) if (morceaux[champ] && vide(champ)) d[champ] = morceaux[champ];
    }
  }

  // Ville connue : orthographe officielle (« st-jerome » → « Saint-Jérôme »)
  // et province du Québec si le fichier n'en donne pas.
  const municipalite = d.ville && trouverMunicipalite(d.ville);
  if (municipalite) {
    d.ville = municipalite;
    if (vide("province")) d.province = "QC";
  }
  if (d.adresse2) d.adresse = [d.adresse, d.adresse2].filter(Boolean).join(", ");

  return {
    nom: (d.nom || "").trim(),
    telephone: formaterTelephone(d.telephone),
    courriel: d.courriel ? d.courriel.trim().toLowerCase() : null,
    adresse: d.adresse ? d.adresse.trim() : null,
    ville: d.ville ? d.ville.trim() : null,
    province: normaliserProvince(d.province),
    codePostal: normaliserCodePostal(d.codePostal),
  };
}

// Phrase du résumé d'import sur ce qui a été deviné au contenu
const LIBELLES_CHAMPS = { ville: "ville", nom: "nom", courriel: "courriel", telephone: "téléphone", codePostal: "code postal", province: "province", adresse: "adresse" };
function noteDetection(detectees) {
  if (!detectees.length) return null;
  return `Colonnes sans en-tête reconnues par leur contenu : ${detectees.map((c) => LIBELLES_CHAMPS[c] || c).join(", ")}.`;
}

module.exports = {
  lireFeuille, mapperEntetes, valeurCellule, lireLigne,
  analyserFeuille, ALIAS_COORDONNEES, nettoyerCoordonnees, noteDetection, formaterTelephone,
};
