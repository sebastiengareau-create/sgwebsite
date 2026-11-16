// Calculs de l'élevage (module « Élevage », voir lib/elevage.js) — sans
// accès à la base, donc utilisables aussi dans les composants du navigateur.
// Poids en kg, prix en $/kg avant taxes.

export const SEXES = [
  { code: "FEMELLE", label: "Femelle" },
  { code: "BOUVILLON", label: "Bouvillon (mâle castré)" },
  { code: "TAUREAU", label: "Taureau" },
];

export const GENETIQUES = [
  { code: "FULLBLOOD", label: "Fullblood (100 % wagyu)" },
  { code: "PUREBRED", label: "Purebred (93,75 % et +)" },
  { code: "CROISE", label: "Croisé (F1, F2…)" },
];

export const STATUTS_BETE = [
  { code: "ACTIVE", label: "Au troupeau", couleur: "#6FA96B" },
  { code: "ABATTUE", label: "Abattue", couleur: "#C9A227" },
  { code: "VENDUE", label: "Vendue sur pied", couleur: "#5B8FD1" },
  { code: "MORTE", label: "Morte", couleur: "#B05A5A" },
];

export const CATEGORIES_FRAIS = [
  { code: "ALIMENTATION", label: "Alimentation" },
  { code: "VETERINAIRE", label: "Vétérinaire / soins" },
  { code: "TRANSPORT", label: "Transport" },
  { code: "AUTRE", label: "Autre" },
];

export const CANAUX = [
  { code: "BOUTIQUE", label: "Boutique", icone: "🏪" },
  { code: "EN_LIGNE", label: "En ligne", icone: "🌐" },
];

// Rendement carcasse par défaut : poids de carcasse froide ÷ poids vif (%).
// Modifiable dans Élevage → Coupes et rendements.
export const RENDEMENT_CARCASSE_DEFAUT = 62;

export const libelle = (liste, code) => liste.find((x) => x.code === code)?.label || code || "—";

export { argent } from "./format";
export const kg = (n, decimales = 1) => `${(n || 0).toLocaleString("fr-CA", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} kg`;

// Date stockée à midi UTC → « 2026-11-05 » (la même journée au Québec)
export const dateCourte = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// La même date, à lire : « 8 déc. 2026 ». dateCourte reste le format des
// champs de date et des comparaisons.
export const dateLisible = (d) => (d ? new Date(d).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

// Âge en mois (ou jours pour un jeune veau) à une date donnée
export function age(dateNaissance, aLaDate = new Date()) {
  if (!dateNaissance) return "";
  const jours = Math.floor((new Date(aLaDate) - new Date(dateNaissance)) / 86400000);
  if (jours < 0) return "";
  if (jours < 60) return `${jours} j`;
  const mois = Math.floor(jours / 30.44);
  return mois < 24 ? `${mois} mois` : `${Math.floor(mois / 12)} ans ${mois % 12} mois`;
}

// Pesées triées par date (plus ancienne d'abord)
const triees = (pesees) => [...(pesees || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

export function dernierePesee(pesees) {
  const t = triees(pesees);
  return t[t.length - 1] || null;
}

// Gain moyen quotidien (kg/jour) entre la première et la dernière pesée —
// null s'il n'y a pas deux pesées à des dates différentes
export function gainMoyenQuotidien(pesees) {
  const t = triees(pesees);
  if (t.length < 2) return null;
  const jours = (new Date(t[t.length - 1].date) - new Date(t[0].date)) / 86400000;
  if (jours < 1) return null;
  return (t[t.length - 1].poids - t[0].poids) / jours;
}

// Gain quotidien depuis la pesée précédente, pour chaque pesée
export function peseesAvecGain(pesees) {
  const t = triees(pesees);
  return t.map((p, i) => {
    if (i === 0) return { ...p, gain: null };
    const jours = (new Date(p.date) - new Date(t[i - 1].date)) / 86400000;
    return { ...p, gain: jours >= 1 ? (p.poids - t[i - 1].poids) / jours : null };
  });
}

// Paquets attendus de chaque coupe pour une carcasse : poids de la coupe =
// carcasse × rendement %, divisé en paquets du poids moyen (arrondi à
// l'inférieur : un paquet incomplet n'en est pas un).
export function estimerDecoupe(poidsCarcasse, coupes) {
  const carcasse = Number(poidsCarcasse) || 0;
  return coupes.map((c) => {
    const poids = (carcasse * (c.rendement || 0)) / 100;
    const paquets = c.poidsPaquet > 0 ? Math.floor(poids / c.poidsPaquet + 1e-9) : 0;
    return {
      coupeId: c.id,
      nom: c.nom,
      poids,
      paquets,
      // Poids réellement en paquets (le reste va au haché ou se perd)
      poidsPaquets: paquets * (c.poidsPaquet || 0),
      valeurBoutique: paquets * (c.poidsPaquet || 0) * (c.prixBoutique || 0),
      valeurEnLigne: c.enLigne ? paquets * (c.poidsPaquet || 0) * (c.prixEnLigne || 0) : 0,
    };
  });
}

export function totauxDecoupe(lignes) {
  return lignes.reduce(
    (t, l) => ({
      paquets: t.paquets + l.paquets,
      poidsPaquets: t.poidsPaquets + l.poidsPaquets,
      valeurBoutique: t.valeurBoutique + l.valeurBoutique,
    }),
    { paquets: 0, poidsPaquets: 0, valeurBoutique: 0 }
  );
}

export const carcasseDepuisVif = (poidsVif, rendementCarcasse) => ((Number(poidsVif) || 0) * (Number(rendementCarcasse) || 0)) / 100;

// Paquets et poids encore en stock d'un lot (lot.ventes inclus)
export function stockLot(lot) {
  const vendus = (lot.ventes || []).reduce((s, v) => s + v.nbPaquets, 0);
  const poidsVendu = (lot.ventes || []).reduce((s, v) => s + v.poids, 0);
  return { paquets: lot.nbPaquets - vendus, poids: Math.max(0, lot.poidsTotal - poidsVendu), vendus };
}

// Coût de revient d'une bête : achat + frais + abattage/découpe
export function coutBete(bete) {
  const frais = (bete.frais || []).reduce((s, f) => s + f.montant, 0);
  return (bete.coutAcquisition || 0) + frais + (bete.abattage?.fraisAbattage || 0);
}

// Revenus d'une bête : viande vendue (tous canaux) ou vente sur pied
export function revenusBete(bete) {
  const viande = (bete.abattage?.lots || []).reduce((s, l) => s + (l.ventes || []).reduce((t, v) => t + v.montant, 0), 0);
  return viande + (bete.statut === "VENDUE" ? bete.prixVente || 0 : 0);
}

// ---------- Santé : soins, délai de retrait, rappels ----------

export const TYPES_SOIN = [
  { code: "VACCIN", label: "Vaccin" },
  { code: "VERMIFUGE", label: "Vermifuge" },
  { code: "TRAITEMENT", label: "Traitement (médicament)" },
  { code: "VISITE", label: "Visite du vétérinaire" },
  { code: "AUTRE", label: "Autre soin" },
];

const JOUR = 86400000;

// Fin du délai de retrait d'un soin : la viande peut être consommée à
// partir de ce jour-là — null si le soin n'a pas de délai
export function finRetrait(soin) {
  return soin.retraitJours > 0 ? new Date(new Date(soin.date).getTime() + soin.retraitJours * JOUR) : null;
}

// Le soin dont le délai de retrait court encore à une date donnée (celui qui
// finit le plus tard) → { soin, fin } ou null. Les dates sont à midi UTC :
// on compare les journées.
export function retraitEnCours(soins, aLaDate = new Date()) {
  const jour = dateCourte(aLaDate);
  let dernier = null;
  for (const soin of soins || []) {
    const fin = finRetrait(soin);
    if (fin && dateCourte(fin) > jour && (!dernier || fin > dernier.fin)) dernier = { soin, fin };
  }
  return dernier;
}

// Rappels encore à faire : un rappel est réglé dès qu'un soin du même type
// est entré après celui qui l'annonçait. Triés du plus pressant au plus loin.
export function rappelsAFaire(soins) {
  const liste = soins || [];
  return liste
    .filter((s) => s.rappelLe && !liste.some((x) => x.type === s.type && new Date(x.date) > new Date(s.date)))
    .sort((a, b) => new Date(a.rappelLe) - new Date(b.rappelLe));
}

// Jours avant l'échéance d'un rappel (négatif : en retard)
export const joursAvant = (d, aLaDate = new Date()) => Math.round((new Date(`${dateCourte(d)}T12:00:00Z`) - new Date(`${dateCourte(aLaDate)}T12:00:00Z`)) / JOUR);

// ---------- Étiquettes et codes QR ----------
// Deux QR : celui d'un paquet de viande mène à la page publique de
// traçabilité de son lot (…/tracabilite/<id du lot>) — le client la lit avec
// son téléphone, et l'appli s'en sert pour vendre le paquet ; celui d'une
// bête mène à sa fiche (…/elevage/<id>), réservée aux employés.

export const urlEtiquetteLot = (origine, lotId) => `${origine.replace(/\/+$/, "")}/tracabilite/${lotId}`;
export const urlEtiquetteBete = (origine, beteId) => `${origine.replace(/\/+$/, "")}/elevage/${beteId}`;

// Ce que désigne un texte scanné → { type: "lot" | "bete", id }, ou
// { type: "code", code } pour un numéro ou une boucle tapés ou lus
// autrement (à chercher dans le troupeau)
export function lireScanElevage(texte) {
  const t = String(texte || "").trim();
  const lot = t.match(/\/tracabilite\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  if (lot) return { type: "lot", id: lot[1] };
  const bete = t.match(/\/elevage\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  if (bete && !["viande", "coupes"].includes(bete[1])) return { type: "bete", id: bete[1] };
  return { type: "code", code: t };
}

// Planches d'étiquettes pour imprimante ordinaire (géométrie :
// lib/pdfEtiquettesPieces.js)
export const FORMATS_ETIQUETTES_ELEVAGE = [
  { code: "avery-5160", label: "Avery 5160 — 1 × 2⅝ po, 30 par feuille", parFeuille: 30 },
  { code: "avery-5162", label: "Avery 5162 — 1⅓ × 4 po, 14 par feuille", parFeuille: 14 },
  { code: "avery-5163", label: "Avery 5163 — 2 × 4 po, 10 par feuille", parFeuille: 10 },
];

// ---------- Reproduction : saillies et vêlages ----------

// Gestation moyenne d'une vache wagyu, de la saillie au vêlage
export const GESTATION_JOURS = 285;

export const TYPES_SAILLIE = [
  { code: "NATURELLE", label: "Saillie naturelle" },
  { code: "IA", label: "Insémination" },
];

export const STATUTS_SAILLIE = [
  { code: "EN_ATTENTE", label: "À confirmer", couleur: "#C9A227" },
  { code: "GESTANTE", label: "Gestante", couleur: "#6FA96B" },
  { code: "VIDE", label: "Non gestante", couleur: "#B05A5A" },
  { code: "VELEE", label: "Vêlée", couleur: "#5B8FD1" },
];

export const velagePrevu = (dateSaillie) => new Date(new Date(dateSaillie).getTime() + GESTATION_JOURS * JOUR);

// Saillie dont on attend encore le vêlage
export const saillieEnCours = (s) => s.statut === "EN_ATTENTE" || s.statut === "GESTANTE";

// Génétique proposée pour un veau : moyenne du pourcentage wagyu de ses
// parents (s'ils sont tous deux connus) → { genetique, pourcentageWagyu }
export function genetiqueVeau(mere, pere) {
  if (mere?.pourcentageWagyu == null || pere?.pourcentageWagyu == null) return { genetique: null, pourcentageWagyu: null };
  const pct = Math.round(((mere.pourcentageWagyu + pere.pourcentageWagyu) / 2) * 100) / 100;
  return { pourcentageWagyu: pct, genetique: pct >= 100 ? "FULLBLOOD" : pct >= 93.75 ? "PUREBRED" : "CROISE" };
}

// ---------- Lignée et consanguinité ----------
// parId : Map id → { id, numero, nom, sexe, mereId, pereId } de tout le
// registre. Seuls les parents inscrits au troupeau comptent : un père entré
// en texte (semence) n'a pas d'ancêtres connus.

// Ancêtres d'une bête → Map id de l'ancêtre → nombre de générations (1 =
// parent, 2 = grand-parent…), le lien le plus court
export function ancetres(id, parId, generations = 4) {
  const trouves = new Map();
  let niveau = [id];
  for (let g = 1; g <= generations && niveau.length; g++) {
    const suivant = [];
    for (const courant of niveau) {
      const b = parId.get(courant);
      for (const parent of [b?.mereId, b?.pereId]) {
        if (!parent || parent === id || trouves.has(parent) || !parId.has(parent)) continue;
        trouves.set(parent, g);
        suivant.push(parent);
      }
    }
    niveau = suivant;
  }
  return trouves;
}

// Liens de parenté entre deux bêtes, sur `generations` générations →
// [{ bete, ga, gb }] : l'ancêtre commun et sa distance à chacune (0 = la
// bête elle-même : l'une descend de l'autre). Un ancêtre commun qui n'est
// commun que par un autre déjà listé (ses propres parents) est omis.
export function parente(aId, bId, parId, generations = 3) {
  if (!aId || !bId || aId === bId) return [];
  const deA = ancetres(aId, parId, generations);
  const deB = ancetres(bId, parId, generations);
  if (deA.has(bId)) return [{ bete: parId.get(bId), ga: deA.get(bId), gb: 0 }];
  if (deB.has(aId)) return [{ bete: parId.get(aId), ga: 0, gb: deB.get(aId) }];
  const communs = [...deA.keys()].filter((x) => deB.has(x));
  const couverts = new Set(communs.flatMap((x) => [...ancetres(x, parId, generations).keys()]));
  return communs
    .filter((x) => !couverts.has(x))
    .map((x) => ({ bete: parId.get(x), ga: deA.get(x), gb: deB.get(x) }))
    .sort((x, y) => x.ga + x.gb - (y.ga + y.gb));
}

export const nomBete = (b) => (b ? `${b.numero}${b.nom ? ` — ${b.nom}` : ""}` : "");

const ASCENDANTS = ["", "parent", "grand-parent", "arrière-grand-parent", "ancêtre"];
const ascendant = (g) => ASCENDANTS[Math.min(g, 4)];

// Un lien de parente(a, b) en mots, a et b étant les noms à afficher
export function decrireParente(lien, a, b) {
  const nom = nomBete(lien.bete);
  if (lien.gb === 0) return `${b} est ${ascendant(lien.ga)} de ${a}`;
  if (lien.ga === 0) return `${a} est ${ascendant(lien.gb)} de ${b}`;
  if (lien.ga === 1 && lien.gb === 1) return `même parent : ${nom} (frère et sœur, ou demi)`;
  return `ancêtre commun : ${nom} (${ascendant(lien.ga)} de ${a}, ${ascendant(lien.gb)} de ${b})`;
}

// ---------- Croissance : gain récent et cible ----------

// Gain moyen quotidien visé pour une bête en croissance (kg/jour).
// Modifiable dans Élevage → Coupes et rendements.
export const GMQ_CIBLE_DEFAUT = 0.8;

// Gain récent : de la dernière pesée à la pesée précédente la plus proche
// qui la devance d'au moins 14 jours (deux pesées trop rapprochées ne disent
// rien), sinon la première → { gmq, depuis, jusqua } ou null
export function gmqRecent(pesees) {
  const t = triees(pesees);
  if (t.length < 2) return null;
  const derniere = t[t.length - 1];
  const avant = t.slice(0, -1);
  const reference = [...avant].reverse().find((p) => new Date(derniere.date) - new Date(p.date) >= 14 * JOUR) || avant[0];
  const jours = (new Date(derniere.date) - new Date(reference.date)) / JOUR;
  if (jours < 1) return null;
  return { gmq: (derniere.poids - reference.poids) / jours, depuis: reference.date, jusqua: derniere.date };
}

// Bête dont on suit la croissance : au troupeau, bouvillon (à l'engrais) ou
// jeune de moins de 24 mois — une vache adulte ne prend plus de poids
export function enCroissance(bete, aLaDate = new Date()) {
  if (bete.statut !== "ACTIVE") return false;
  if (bete.sexe === "BOUVILLON") return true;
  return !!bete.dateNaissance && (new Date(aLaDate) - new Date(bete.dateNaissance)) / JOUR < 24 * 30.44;
}

// ---------- Portrait du troupeau : catégories et abattages à venir ----------

// Catégorie d'une bête au troupeau selon son sexe et son âge : veau jusqu'au
// sevrage (8 mois), génisse jusqu'à 24 mois, puis vache
export const CATEGORIES_TROUPEAU = [
  { code: "VACHE", label: "Vaches", singulier: "Vache" },
  { code: "GENISSE", label: "Génisses", singulier: "Génisse" },
  { code: "TAUREAU", label: "Taureaux", singulier: "Taureau" },
  { code: "BOUVILLON", label: "Bouvillons", singulier: "Bouvillon" },
  { code: "VEAU", label: "Veaux", singulier: "Veau" },
];

export function categorieBete(bete, aLaDate = new Date()) {
  const mois = bete.dateNaissance ? (new Date(aLaDate) - new Date(bete.dateNaissance)) / JOUR / 30.44 : null;
  if (mois !== null && mois < 8) return "VEAU";
  if (bete.sexe === "FEMELLE") return mois !== null && mois < 24 ? "GENISSE" : "VACHE";
  return bete.sexe;
}

// Poids vif visé à l'abattage (kg). Modifiable dans Élevage → Coupes et
// rendements.
export const POIDS_ABATTAGE_DEFAUT = 750;

// Où en est un bouvillon vers le poids d'abattage visé : son dernier poids,
// et la date où il l'atteindra au rythme de son gain récent (sinon de son
// gain moyen). → null si ce n'est pas un bouvillon au troupeau déjà pesé ;
// date null si le poids est atteint (atteint: true), si le gain est nul, ou
// si à ce rythme il faudrait plus de deux ans (une prévision aussi lointaine
// ne dit rien — c'est le gain qu'il faut corriger).
export function abattagePrevu(bete, poidsVise) {
  if (bete.statut !== "ACTIVE" || bete.sexe !== "BOUVILLON") return null;
  const pesee = dernierePesee(bete.pesees);
  if (!pesee) return null;
  const base = { poids: pesee.poids, part: Math.min(1, pesee.poids / poidsVise), atteint: pesee.poids >= poidsVise, date: null, gmq: null };
  if (base.atteint) return base;
  const recent = gmqRecent(bete.pesees)?.gmq;
  const gmq = recent > 0 ? recent : gainMoyenQuotidien(bete.pesees);
  if (!(gmq > 0)) return base;
  if ((poidsVise - pesee.poids) / gmq > 730) return { ...base, gmq };
  return { ...base, gmq, date: new Date(new Date(pesee.date).getTime() + ((poidsVise - pesee.poids) / gmq) * JOUR) };
}

// Gain récent d'une bête en croissance s'il est sous la cible, sinon null
export function sousLaCible(bete, cible) {
  if (!enCroissance(bete)) return null;
  const recent = gmqRecent(bete.pesees);
  return recent && recent.gmq < cible ? recent : null;
}
