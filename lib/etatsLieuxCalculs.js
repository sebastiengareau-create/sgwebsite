// État des lieux numérique (module Immobilier, lib/etatsLieux.js) — listes
// et calculs sans base de données, utilisables aussi dans le navigateur.
//
// Un état des lieux décrit le logement pièce par pièce : pour chaque
// élément (murs, plancher, électroménagers…), son état, une remarque et des
// photos. À la sortie, on reprend les pièces et les éléments de l'entrée pour
// comparer point par point ce qui s'est dégradé.

export const MOMENTS_ETAT_LIEUX = [
  { code: "ENTREE", label: "Entrée" },
  { code: "SORTIE", label: "Sortie" },
];

export const ETATS_ELEMENT = [
  { code: "BON", label: "Bon", couleur: "#3c8a42", rang: 0 },
  { code: "USURE", label: "Usure normale", couleur: "#3f6fa3", rang: 1 },
  { code: "DOMMAGE", label: "Endommagé", couleur: "#b23f2c", rang: 2 },
  { code: "NA", label: "Sans objet", couleur: "#8A8579", rang: -1 },
];
const RANG = Object.fromEntries(ETATS_ELEMENT.map((e) => [e.code, e.rang]));

// Éléments de chaque genre de pièce
const COMMUNS = ["Murs", "Plafond", "Plancher", "Portes et serrures", "Fenêtres et moustiquaires", "Prises, interrupteurs, luminaires"];
const ELEMENTS_PIECE = {
  entree: ["Porte d'entrée et serrure", "Murs", "Plancher", "Garde-robe", "Avertisseur de fumée", "Sonnette, interphone"],
  cuisine: [...COMMUNS, "Armoires et comptoir", "Évier et robinet", "Cuisinière", "Réfrigérateur", "Hotte"],
  salon: COMMUNS,
  chambre: [...COMMUNS, "Garde-robe"],
  bain: ["Murs", "Plafond", "Plancher", "Porte", "Toilette", "Lavabo et robinet", "Bain ou douche", "Ventilateur", "Miroir et pharmacie", "Prises, interrupteurs, luminaires"],
  lavage: ["Murs", "Plancher", "Entrées laveuse et sécheuse", "Sortie de sécheuse"],
  balcon: ["Plancher", "Garde-corps", "Porte"],
  rangement: ["Porte et serrure", "Murs", "Plancher"],
  local: [...COMMUNS, "Toilettes", "Chauffage et ventilation"],
};

// Clé courte et stable d'une pièce ou d'un élément (les photos s'y rattachent)
export const nouvelleCle = () => Math.random().toString(36).slice(2, 10);

const piece = (nom, genre) => ({ cle: nouvelleCle(), nom, elements: ELEMENTS_PIECE[genre].map((e) => ({ cle: nouvelleCle(), nom: e, etat: null, note: "" })) });

// Grille de départ selon le logement : « 4 ½ » → entrée, cuisine, salon,
// 2 chambres, salle de bain, salle de lavage, balcon, rangement. Un local
// commercial : espace principal et toilettes.
export function piecesParDefaut(logement) {
  if (logement?.type && logement.type !== "LOGEMENT") return [piece("Espace principal", "local"), piece("Rangement", "rangement")];
  // « 4 ½ », « 4½ », « 4 1/2 », « 4,5 »
  const n = Number(String(logement?.pieces || "").replace(",", ".").replace(/\s*(½|1\/2)/, ".5").replace(/\s/g, "").match(/\d+(\.\d+)?/)?.[0]) || 4.5;
  if (n < 2.5) return [piece("Pièce principale", "salon"), piece("Cuisinette", "cuisine"), piece("Salle de bain", "bain")];
  const chambres = Math.max(1, Math.floor(n) - 2);
  return [
    piece("Entrée", "entree"),
    piece("Cuisine", "cuisine"),
    piece("Salon", "salon"),
    ...Array.from({ length: chambres }, (_, i) => piece(chambres > 1 ? `Chambre ${i + 1}` : "Chambre", "chambre")),
    piece("Salle de bain", "bain"),
    piece("Salle de lavage", "lavage"),
    piece("Balcon ou galerie", "balcon"),
    piece("Rangement ou casier", "rangement"),
  ];
}

// Nouvelle pièce ajoutée à la main : les éléments communs
export const pieceVide = (nom) => ({ cle: nouvelleCle(), nom, elements: COMMUNS.map((e) => ({ cle: nouvelleCle(), nom: e, etat: null, note: "" })) });

// Sortie : mêmes pièces et éléments que l'entrée (pour comparer), états à noter
export const piecesPourSortie = (entree) => (entree || []).map((p) => ({ cle: nouvelleCle(), nom: p.nom, elements: p.elements.map((e) => ({ cle: nouvelleCle(), nom: e.nom, etat: null, note: "" })) }));

// Avancement : éléments notés / total
export function avancement(pieces) {
  const elements = (pieces || []).flatMap((p) => p.elements);
  return { notes: elements.filter((e) => e.etat).length, total: elements.length };
}

const cleNom = (piece, element) => `${String(piece).trim().toLowerCase()}|${String(element).trim().toLowerCase()}`;

// Ce qui avait été noté à l'entrée pour chaque élément de la sortie, par
// nom de pièce et d'élément → { [cle de l'élément de sortie]: { etat, note, pire } }
// pire : l'élément est en plus mauvais état qu'à l'entrée (dommage nouveau)
export function comparerAEntree(entree, sortie) {
  const avant = new Map();
  for (const p of entree || []) for (const e of p.elements) avant.set(cleNom(p.nom, e.nom), e);
  const out = {};
  for (const p of sortie || []) {
    for (const e of p.elements) {
      const a = avant.get(cleNom(p.nom, e.nom));
      if (!a) continue;
      const pire = RANG[e.etat] != null && RANG[a.etat] != null && RANG[e.etat] >= 0 && RANG[a.etat] >= 0 && RANG[e.etat] > RANG[a.etat];
      out[e.cle] = { etat: a.etat, note: a.note || "", pire };
    }
  }
  return out;
}

// Éléments endommagés depuis l'entrée → [{ piece, element, avant, apres, note }]
export function dommagesDepuisEntree(entree, sortie) {
  const comp = comparerAEntree(entree, sortie);
  return (sortie || []).flatMap((p) => p.elements.filter((e) => comp[e.cle]?.pire && e.etat === "DOMMAGE").map((e) => ({ piece: p.nom, element: e.nom, avant: comp[e.cle].etat, apres: e.etat, note: e.note || "" })));
}

// Pièces reçues du navigateur, nettoyées → { pieces } ou { erreur }
export function normaliserPieces(entree) {
  if (!Array.isArray(entree)) return { erreur: "Pièces invalides." };
  if (entree.length > 40) return { erreur: "Trop de pièces (40 au plus)." };
  const codes = new Set(ETATS_ELEMENT.map((e) => e.code));
  const texte = (x, max) => String(x ?? "").slice(0, max);
  const cle = (x) => (/^[a-z0-9]{4,16}$/.test(String(x || "")) ? String(x) : nouvelleCle());
  const pieces = [];
  for (const p of entree) {
    const nom = texte(p?.nom, 80).trim();
    if (!nom) return { erreur: "Chaque pièce doit avoir un nom." };
    const elements = Array.isArray(p.elements) ? p.elements.slice(0, 60) : [];
    pieces.push({
      cle: cle(p.cle), nom,
      elements: elements.filter((e) => texte(e?.nom, 120).trim()).map((e) => ({ cle: cle(e.cle), nom: texte(e.nom, 120).trim(), etat: codes.has(e.etat) ? e.etat : null, note: texte(e.note, 1000) })),
    });
  }
  return { pieces };
}

// Compteurs et clés reçus → objet propre
export function normaliserCompteurs(c = {}) {
  const t = (x, max = 120) => String(x ?? "").slice(0, max);
  return {
    electricite: t(c.electricite, 40), clesPorte: t(c.clesPorte, 20), clesBoite: t(c.clesBoite, 20), autresCles: t(c.autresCles, 160),
    avertisseurTeste: c.avertisseurTeste === true, adresseSuivante: t(c.adresseSuivante, 300),
  };
}
