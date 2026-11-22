// Entreposage de pneus : libellés, saison à venir et vérification d'un jeu —
// sans dépendance au serveur, donc utilisables aussi dans le navigateur. Le
// reste (lecture, mouvements, rappels) : lib/pneus.js.
//
// Au Québec, les pneus d'hiver sont obligatoires du 1er décembre au 15 mars :
// on rappelle la pose des pneus d'hiver à l'automne, et le retour aux pneus
// d'été au printemps.

export const SAISONS = {
  HIVER: { libelle: "Hiver", deSaison: "d'hiver" },
  ETE: { libelle: "Été", deSaison: "d'été" },
  QUATRE_SAISONS: { libelle: "Quatre saisons", deSaison: "quatre saisons" },
};

export const JANTES = {
  SANS: "Sans jantes",
  ACIER: "Sur jantes d'acier",
  ALLIAGE: "Sur jantes d'alliage",
};

export const STATUTS_JEU = {
  ENTREPOSE: { libelle: "À l'entrepôt", couleur: "var(--bleu)", fond: "var(--bleu-fond)" },
  POSE: { libelle: "Sur le véhicule", couleur: "var(--success)", fond: "var(--success-fond)" },
  REMIS: { libelle: "Remis au client", couleur: "var(--text-muted)", fond: "var(--surface-alt)" },
};

export const TYPES_MOUVEMENT = {
  ENTREE: "Entré à l'entrepôt",
  SORTIE: "Sorti et posé sur le véhicule",
  REMISE: "Remis au client",
  DEPLACEMENT: "Changé d'emplacement",
};

// « Pneus d'hiver 225/65R17 »
export function libelleJeu(jeu) {
  const saison = SAISONS[jeu.saison]?.deSaison || "";
  return `Pneus ${saison}${jeu.dimension ? ` ${jeu.dimension}` : ""}`.trim();
}

// Même chose au fil d'une phrase : « pneus d'hiver 225/65R17 »
export function libelleJeuMinuscule(jeu) {
  const l = libelleJeu(jeu);
  return l.charAt(0).toLowerCase() + l.slice(1);
}

// Mois (1 à 12) au Québec
function moisQuebec(date) {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "numeric" }).format(date));
}
function anneeQuebec(date) {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric" }).format(date));
}

// Changement de saison qui vient : de juillet à décembre, la pose des pneus
// d'hiver ; de janvier à juin, le retour aux pneus d'été. debut : début de
// cette période de rappel (un rappel envoyé depuis compte pour la saison).
export function saisonAVenir(date = new Date()) {
  const annee = anneeQuebec(date);
  if (moisQuebec(date) >= 7) {
    return {
      saison: "HIVER", titre: "Pose des pneus d'hiver", echeance: "au plus tard le 1er décembre",
      debut: new Date(`${annee}-07-01T12:00:00Z`),
    };
  }
  return {
    saison: "ETE", titre: "Retour aux pneus d'été", echeance: "à partir du 16 mars",
    debut: new Date(`${annee}-01-01T12:00:00Z`),
  };
}

// Jeu à rappeler pour le changement de saison qui vient : à l'entrepôt, de
// la saison qui arrive
export const estARappeler = (jeu, aVenir = saisonAVenir()) => jeu.statut === "ENTREPOSE" && jeu.saison === aVenir.saison;
export const dejaRappele = (jeu, aVenir = saisonAVenir()) => !!jeu.rappelLe && new Date(jeu.rappelLe) >= aVenir.debut;

// Usure « 8 8 7 7 » ou « 8/8/7/7 » → « 8, 8, 7, 7 » (nombres de 0 à 20)
export function normaliserUsure(texte) {
  const valeurs = String(texte ?? "").match(/\d+(?:[.,]\d+)?/g) || [];
  const nombres = valeurs.map((v) => Number(v.replace(",", "."))).filter((n) => n >= 0 && n <= 20);
  return nombres.length ? nombres.map((n) => String(n).replace(".", ",")).join(", ") : null;
}

// Plus faible usure d'un jeu (/32 po), ou null
export function usureMinimale(usure) {
  const nombres = (String(usure ?? "").match(/\d+(?:[.,]\d+)?/g) || []).map((v) => Number(v.replace(",", ".")));
  return nombres.length ? Math.min(...nombres) : null;
}

// Année de fabrication : 2018, ou le code DOT à 4 chiffres (2318 : 23e
// semaine de 2018) → 2018 ; null si illisible
export function lireAnneeFabrication(valeur) {
  const t = String(valeur ?? "").replace(/\D/g, "");
  if (!t) return null;
  if (t.length === 4 && Number(t) >= 1990 && Number(t) <= 2100) return Number(t);
  if (t.length === 4) {
    const semaine = Number(t.slice(0, 2));
    const an = 2000 + Number(t.slice(2));
    if (semaine >= 1 && semaine <= 53) return an;
  }
  return NaN;
}

// Champs d'un jeu reçus d'un formulaire → { data } ou { erreur }. partiel :
// seuls les champs reçus sont vérifiés (modification).
export function normaliserJeu(brut, { partiel = false } = {}) {
  const data = {};
  const texte = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max) || null;
  const a = (cle) => !partiel || cle in brut;

  if (a("saison")) {
    if (!SAISONS[brut.saison]) return { erreur: "Choisis la saison des pneus." };
    data.saison = brut.saison;
  }
  if (a("jantes")) {
    if (brut.jantes != null && !JANTES[brut.jantes]) return { erreur: "Jantes invalides." };
    data.jantes = brut.jantes || "SANS";
  }
  if (a("quantite")) {
    const q = Math.round(Number(brut.quantite ?? 4));
    if (!(q >= 1 && q <= 12)) return { erreur: "Quantité de pneus : de 1 à 12." };
    data.quantite = q;
  }
  if (a("marque")) data.marque = texte(brut.marque, 40);
  if (a("modele")) data.modele = texte(brut.modele, 60);
  if (a("dimension")) data.dimension = texte(brut.dimension, 30)?.toUpperCase() ?? null;
  if (a("note")) data.note = texte(brut.note, 500);
  if (a("emplacement")) data.emplacement = texte(brut.emplacement, 30)?.toUpperCase() ?? null;
  if (a("usure")) data.usure = normaliserUsure(brut.usure);
  if (a("anneeFabrication")) {
    const an = lireAnneeFabrication(brut.anneeFabrication);
    if (Number.isNaN(an)) return { erreur: "Année de fabrication : l'année (ex. 2021) ou le code DOT à 4 chiffres (ex. 2321)." };
    data.anneeFabrication = an;
  }
  return { data };
}

// Formats d'étiquettes offerts (lib/pdfEtiquettesPieces.js) : assez grandes
// pour se lire sur un pneu
export const FORMATS_ETIQUETTES_PNEUS = [
  { code: "avery-5163", label: "Avery 5163 — 2 × 4 po, 10 par feuille", parFeuille: 10 },
  { code: "avery-5162", label: "Avery 5162 — 1⅓ × 4 po, 14 par feuille", parFeuille: 14 },
  { code: "zebra-4x2", label: "Zebra — rouleau 4 × 2 po", parFeuille: 1 },
];
