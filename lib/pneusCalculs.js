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
// seuls les champs reçus sont vérifiés (modification). Avec le détail pneu
// par pneu (pneus), l'usure du jeu et son année de fabrication (le plus
// vieux pneu) en sont tirées. data.pneus vaut null pour effacer le détail.
export function normaliserJeu(brut, { partiel = false, maintenant = new Date() } = {}) {
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
  if (brut.pneus !== undefined) {
    const { pneus, erreur } = normaliserPneus(brut.pneus, maintenant);
    if (erreur) return { erreur };
    data.pneus = pneus && data.quantite ? pneus.slice(0, data.quantite) : pneus;
    data.usure = data.pneus ? usureDuDetail(data.pneus) : null; // l'usure vient du détail
    if (data.pneus) {
      const annees = data.pneus.map((x) => lireDot(x.dot)?.annee).filter(Boolean);
      if (annees.length) data.anneeFabrication = Math.min(...annees);
    }
  }

  // Roues et équipement
  if (a("antivol")) {
    if (brut.antivol && !ANTIVOL[brut.antivol]) return { erreur: "Clé antivol : choix invalide." };
    data.antivol = brut.antivol || null;
  }
  const oui = (v) => v === true || v === "true" || v === "on" || v === 1;
  if (a("capteurs")) data.capteurs = oui(brut.capteurs);
  if (a("enjoliveurs")) data.enjoliveurs = oui(brut.enjoliveurs);
  const entier = (cle, min, max, message) => {
    if (!a(cle)) return null;
    const t = String(brut[cle] ?? "").replace(/\s/g, "").replace(",", ".");
    if (!t) { data[cle] = null; return null; }
    const n = Math.round(Number(t));
    if (!(Number.isFinite(Number(t)) && n >= min && n <= max)) return message;
    data[cle] = n;
    return null;
  };
  const erreurEntier = entier("couple", 20, 400, "Couple de serrage : en lb-pi, de 20 à 400 (ex. 100).")
    || entier("pression", 15, 120, "Pression : en lb/po², de 15 à 120 (ex. 35).");
  if (erreurEntier) return { erreur: erreurEntier };
  return { data };
}

// ---------- Pneu par pneu ----------

// Positions des pneus d'un jeu ; un jeu de 2, 3 ou de plus de 6 pneus est
// numéroté (« Pneu 1 », « Pneu 2 »…)
export const POSITIONS = {
  AVG: { libelle: "Avant gauche", court: "Av. g.", avant: true },
  AVD: { libelle: "Avant droit", court: "Av. d.", avant: true },
  ARG: { libelle: "Arrière gauche", court: "Arr. g." },
  ARD: { libelle: "Arrière droit", court: "Arr. d." },
  ARGE: { libelle: "Arrière gauche extérieur", court: "Arr. g. ext." },
  ARGI: { libelle: "Arrière gauche intérieur", court: "Arr. g. int." },
  ARDI: { libelle: "Arrière droit intérieur", court: "Arr. d. int." },
  ARDE: { libelle: "Arrière droit extérieur", court: "Arr. d. ext." },
  SECOURS: { libelle: "Secours", court: "Secours", secours: true },
};

export function positionsPour(quantite) {
  const q = Math.min(12, Math.max(1, Math.round(Number(quantite) || 4)));
  if (q === 4) return ["AVG", "AVD", "ARG", "ARD"];
  if (q === 5) return ["AVG", "AVD", "ARG", "ARD", "SECOURS"];
  if (q === 6) return ["AVG", "AVD", "ARGE", "ARGI", "ARDI", "ARDE"];
  return Array.from({ length: q }, (_, i) => `P${i + 1}`);
}

const positionValide = (code) => !!POSITIONS[code] || /^P([1-9]|1[0-2])$/.test(String(code || ""));
export const libellePosition = (code) => POSITIONS[code]?.libelle || (/^P(\d+)$/.test(code || "") ? `Pneu ${code.slice(1)}` : String(code || ""));
export const libelleCourtPosition = (code) => POSITIONS[code]?.court || (/^P(\d+)$/.test(code || "") ? `Pneu ${code.slice(1)}` : String(code || ""));

const nombreFr = (n) => String(Math.round(n * 10) / 10).replace(".", ",");

// Code DOT d'un pneu : les 4 derniers chiffres, semaine puis année (2321 :
// 23e semaine de 2021) → { code, semaine, annee }, null si vide, NaN si
// illisible
export function lireDot(valeur, maintenant = new Date()) {
  const t = String(valeur ?? "").replace(/\D/g, "");
  if (!t) return null;
  if (t.length !== 4) return NaN;
  const semaine = Number(t.slice(0, 2));
  const annee = 2000 + Number(t.slice(2));
  if (semaine < 1 || semaine > 53 || annee > maintenant.getUTCFullYear() + 1) return NaN;
  return { code: t, semaine, annee };
}

// Âge en années complètes d'un pneu selon son code DOT, ou null
export function ageDot(dot, maintenant = new Date()) {
  const d = typeof dot === "object" && dot ? dot : lireDot(dot, maintenant);
  if (!d || Number.isNaN(d)) return null;
  const fabrication = Date.UTC(d.annee, 0, 1) + (d.semaine - 1) * 7 * 86400000;
  return Math.max(0, Math.floor((maintenant.getTime() - fabrication) / (365.25 * 86400000)));
}

// Usure d'un pneu : « 7 », « 7,5 », « 7/32 » → 7 (de 0 à 20), null si vide,
// NaN si illisible
function lireUsurePneu(valeur) {
  if (typeof valeur === "number") return valeur >= 0 && valeur <= 20 ? Math.round(valeur * 10) / 10 : NaN;
  const t = String(valeur ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:\/\s*32)?\s*(?:po)?$/i);
  if (!m) return NaN;
  const n = Number(m[1].replace(",", "."));
  return n >= 0 && n <= 20 ? Math.round(n * 10) / 10 : NaN;
}

// Détail reçu d'un formulaire → { pneus } (null si rien n'est rempli) ou
// { erreur }
export function normaliserPneus(liste, maintenant = new Date()) {
  if (liste == null) return { pneus: null };
  if (!Array.isArray(liste) || liste.length > 12) return { erreur: "Détail des pneus invalide." };
  const pneus = [];
  for (const [i, brut] of liste.entries()) {
    const position = positionValide(brut?.position) ? brut.position : `P${i + 1}`;
    const nom = libellePosition(position).toLowerCase();
    const usure = lireUsurePneu(brut?.usure);
    if (Number.isNaN(usure)) return { erreur: `Usure du pneu ${nom} : en 32es de pouce, de 0 à 20 (ex. 7).` };
    const dot = lireDot(brut?.dot, maintenant);
    if (Number.isNaN(dot)) return { erreur: `Code DOT du pneu ${nom} : les 4 derniers chiffres, semaine puis année (ex. 2321).` };
    const note = String(brut?.note ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || null;
    pneus.push({ position, usure, dot: dot?.code || null, remplacer: brut?.remplacer === true, note });
  }
  const rempli = pneus.some((x) => x.usure != null || x.dot || x.remplacer || x.note);
  return { pneus: rempli ? pneus : null };
}

// Usure du jeu en texte (« 8, 8, 7, 7 ») à partir du détail, ou null
export function usureDuDetail(pneus) {
  const valeurs = (pneus || []).map((x) => x.usure).filter((n) => n != null);
  return valeurs.length ? valeurs.map(nombreFr).join(", ") : null;
}

// Détail pneu par pneu d'un jeu, toujours une ligne par pneu : le détail
// enregistré, ou, pour un jeu inscrit avant, l'usure du texte dans l'ordre
// des positions
export function pneusDuJeu(jeu) {
  const positions = positionsPour(jeu?.quantite);
  if (Array.isArray(jeu?.pneus) && jeu.pneus.length) {
    return positions.map((position, i) => {
      const p = jeu.pneus[i] || {};
      return { position: p.position || position, usure: p.usure ?? null, dot: p.dot || null, remplacer: !!p.remplacer, note: p.note || null };
    });
  }
  const usures = (String(jeu?.usure ?? "").match(/\d+(?:[.,]\d+)?/g) || []).map((v) => Number(v.replace(",", ".")));
  return positions.map((position, i) => ({ position, usure: usures[i] ?? null, dot: null, remplacer: false, note: null }));
}

// Nouvelles mesures d'usure (une par pneu, dans l'ordre ; vide : inchangée)
// appliquées au détail → { pneus, usure }
export function appliquerUsures(jeu, usures) {
  const detail = pneusDuJeu(jeu).map((p, i) => {
    const u = lireUsurePneu(usures?.[i]);
    return u == null || Number.isNaN(u) ? p : { ...p, usure: u };
  });
  return { pneus: detail, usure: usureDuDetail(detail) };
}

// ---------- État du jeu ----------

// Seuils de l'état d'un jeu (Entreposage de pneus → Réglages, réglage
// pneus_seuils). 2/32 po est la limite légale au Canada ; à 4/32 po, un pneu
// d'hiver a perdu l'essentiel de son adhérence sur la neige et un pneu d'été
// sur la chaussée mouillée. Les fabricants conseillent de faire vérifier un
// pneu chaque année passé 5 ou 6 ans, et de le remplacer à 10 ans.
export const SEUILS_PNEUS_DEFAUT = { usureRemplacer: 4, usureSurveiller: 6, ageSurveiller: 6, ageRemplacer: 10 };

export function normaliserSeuils(brut) {
  const s = { ...SEUILS_PNEUS_DEFAUT };
  for (const cle of Object.keys(SEUILS_PNEUS_DEFAUT)) {
    const t = String(brut?.[cle] ?? "").replace(",", ".").trim();
    if (t === "") continue;
    const n = Number(t);
    const max = cle.startsWith("usure") ? 20 : 30;
    if (!(Number.isFinite(n) && n >= 0 && n <= max)) return { erreur: "Seuils : des nombres (usure de 0 à 20/32 po, âge de 0 à 30 ans)." };
    s[cle] = Math.round(n * 10) / 10;
  }
  if (s.usureSurveiller < s.usureRemplacer) return { erreur: "Le seuil « à surveiller » de l'usure doit être plus haut que celui « à remplacer »." };
  if (s.ageSurveiller > s.ageRemplacer) return { erreur: "L'âge « à surveiller » doit être plus bas que l'âge « à remplacer »." };
  return { seuils: s };
}

export const ETATS_JEU = {
  REMPLACER: { libelle: "À remplacer", couleur: "var(--danger)", fond: "var(--danger-fond)" },
  SURVEILLER: { libelle: "À surveiller", couleur: "var(--avertissement)", fond: "var(--avertissement-fond)" },
  BON: { libelle: "En bon état", couleur: "var(--success)", fond: "var(--success-fond)" },
};

// Âge du jeu : celui du plus vieux pneu (code DOT), sinon l'année de
// fabrication du jeu ; null si inconnu
export function ageJeu(jeu, maintenant = new Date()) {
  const ages = pneusDuJeu(jeu).map((p) => ageDot(p.dot, maintenant)).filter((n) => n != null);
  if (ages.length) return Math.max(...ages);
  return jeu?.anneeFabrication ? Math.max(0, maintenant.getUTCFullYear() - jeu.anneeFabrication) : null;
}

// État d'un jeu → { code: "REMPLACER" | "SURVEILLER" | "BON" | null (rien de
// mesuré), raisons, usureMin, age, conseils (à la pose) }
export function evaluerJeu(jeu, seuils = SEUILS_PNEUS_DEFAUT, maintenant = new Date()) {
  const s = { ...SEUILS_PNEUS_DEFAUT, ...seuils };
  const detail = pneusDuJeu(jeu);
  const raisons = [];
  let niveau = 0;
  const monter = (n, raison) => { niveau = Math.max(niveau, n); raisons.push(raison); };

  const usures = detail.map((p) => p.usure).filter((n) => n != null);
  const usureMin = usures.length ? Math.min(...usures) : usureMinimale(jeu?.usure);
  if (usureMin != null) {
    if (usureMin <= s.usureRemplacer) monter(3, `Usure de ${nombreFr(usureMin)}/32 po`);
    else if (usureMin <= s.usureSurveiller) monter(2, `Usure de ${nombreFr(usureMin)}/32 po`);
  }
  const age = ageJeu(jeu, maintenant);
  if (age != null) {
    if (age >= s.ageRemplacer) monter(3, `Pneus de ${age} ans`);
    else if (age >= s.ageSurveiller) monter(2, `Pneus de ${age} ans`);
  }
  for (const p of detail) if (p.remplacer) monter(3, `${libellePosition(p.position)} : ${p.note || "endommagé"}`);

  const code = niveau === 3 ? "REMPLACER" : niveau === 2 ? "SURVEILLER" : usureMin != null || age != null ? "BON" : null;
  return { code, raisons, usureMin, age, conseils: conseilsPose(detail) };
}

const moyenne = (l) => l.reduce((t, n) => t + n, 0) / l.length;

// Conseils pour la pose, tirés de l'usure pneu par pneu : usure inégale entre
// l'avant et l'arrière (permutation) ou entre la gauche et la droite d'un
// même essieu (alignement à vérifier). Écart signalé : 2/32 po.
export function conseilsPose(detail) {
  const conseils = [];
  const mesure = (filtre) => detail.filter((p) => p.usure != null && filtre(p)).map((p) => p.usure);
  const avant = mesure((p) => POSITIONS[p.position]?.avant);
  const arriere = mesure((p) => POSITIONS[p.position] && !POSITIONS[p.position].avant && !POSITIONS[p.position].secours);
  if (avant.length && arriere.length && Math.abs(moyenne(avant) - moyenne(arriere)) >= 2) {
    conseils.push(`Usure inégale entre l'avant (${nombreFr(moyenne(avant))}/32) et l'arrière (${nombreFr(moyenne(arriere))}/32 po) : permutation conseillée à la pose.`);
  }
  const ecart = (g, d) => {
    const a = detail.find((p) => p.position === g)?.usure;
    const b = detail.find((p) => p.position === d)?.usure;
    return a != null && b != null && Math.abs(a - b) >= 2;
  };
  if (ecart("AVG", "AVD")) conseils.push("Usure inégale entre la gauche et la droite à l'avant : vérifier l'alignement.");
  if (ecart("ARG", "ARD")) conseils.push("Usure inégale entre la gauche et la droite à l'arrière : vérifier l'alignement.");
  return conseils;
}

// ---------- Roues et équipement ----------

export const ANTIVOL = {
  AVEC_JEU: "Clé antivol rangée avec le jeu",
  VEHICULE: "Clé antivol dans le véhicule",
};

// « Clé antivol rangée avec le jeu », « Capteurs de pression »… à rappeler à la pose
export function resumeEquipement(jeu) {
  return [
    jeu?.antivol && ANTIVOL[jeu.antivol],
    jeu?.capteurs && "Capteurs de pression (TPMS)",
    jeu?.enjoliveurs && "Enjoliveurs avec le jeu",
    jeu?.couple && `Serrage à ${jeu.couple} lb-pi`,
    jeu?.pression && `Pression ${jeu.pression} lb/po²`,
  ].filter(Boolean);
}

// ---------- Plan de l'entrepôt ----------

// Plan (Entreposage de pneus → Réglages, réglage pneus_entrepot) : des
// rangées, chacune avec un code et un nombre de places. Les places se nomment
// code-numéro : A-01, A-02… (assez de chiffres pour la plus grande).
// { rangees: [{ code: "A", nom: "Mezzanine", places: 24 }] }
export function normaliserPlan(brut) {
  const liste = Array.isArray(brut?.rangees) ? brut.rangees : [];
  if (liste.length > 40) return { erreur: "Plan de l'entrepôt : 40 rangées au plus." };
  const rangees = [];
  for (const r of liste) {
    const code = String(r?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    const nom = String(r?.nom ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || null;
    const places = Math.round(Number(String(r?.places ?? "").replace(",", ".")));
    if (!code && !nom && !r?.places) continue; // ligne laissée vide
    if (!code) return { erreur: "Chaque rangée a besoin d'un code (ex. A)." };
    if (rangees.some((x) => x.code === code)) return { erreur: `Le code de rangée ${code} est en double.` };
    if (!(places >= 1 && places <= 500)) return { erreur: `Rangée ${code} : de 1 à 500 places.` };
    rangees.push({ code, nom, places });
  }
  return { plan: { rangees } };
}

export const largeurNumero = (places) => Math.max(2, String(places).length);
export const emplacementsRangee = (r) => Array.from({ length: r.places }, (_, i) => `${r.code}-${String(i + 1).padStart(largeurNumero(r.places), "0")}`);
export const tousEmplacements = (plan) => (plan?.rangees || []).flatMap(emplacementsRangee);

// Clé de comparaison d'un emplacement : « a 4 », « A04 », « A-004 » → « A-4 »
export function cleEmplacement(texte) {
  return String(texte ?? "").toUpperCase().trim()
    .replace(/([A-Z])(?=\d)/g, "$1-").replace(/(\d)(?=[A-Z])/g, "$1-")
    .split(/[\s\-_.\/]+/).filter(Boolean)
    .map((seg) => (/^\d+$/.test(seg) ? String(Number(seg)) : seg)).join("-");
}

// Emplacement tel qu'il s'enregistre : le nom de la place du plan qui lui
// correspond (« a4 » → « A-04 »), sinon le texte en majuscules
export function canoniserEmplacement(texte, plan) {
  const t = String(texte ?? "").replace(/\s+/g, " ").trim().toUpperCase().slice(0, 30);
  if (!t) return null;
  const cle = cleEmplacement(t);
  return tousEmplacements(plan).find((nom) => cleEmplacement(nom) === cle) || t;
}

// Plan rempli : chaque rangée avec ses places et le jeu qui l'occupe ;
// horsPlan : jeux entreposés à un emplacement qui n'est pas au plan
export function occupationPlan(plan, jeuxEntreposes) {
  const parCle = new Map();
  for (const j of jeuxEntreposes) {
    const cle = cleEmplacement(j.emplacement);
    if (!parCle.has(cle)) parCle.set(cle, []);
    parCle.get(cle).push(j);
  }
  const vus = new Set();
  const rangees = (plan?.rangees || []).map((r) => ({
    ...r,
    cases: emplacementsRangee(r).map((nom) => {
      const cle = cleEmplacement(nom);
      vus.add(cle);
      return { nom, jeux: parCle.get(cle) || [] };
    }),
  }));
  const total = rangees.reduce((t, r) => t + r.cases.length, 0);
  const occupees = rangees.reduce((t, r) => t + r.cases.filter((c) => c.jeux.length).length, 0);
  const horsPlan = jeuxEntreposes.filter((j) => !vus.has(cleEmplacement(j.emplacement)));
  return { rangees, total, occupees, libres: total - occupees, horsPlan };
}

// Premières places libres du plan (dans l'ordre des rangées), n au plus
export function placesLibres(plan, occupes, n = 6) {
  const pris = new Set((occupes || []).map(cleEmplacement));
  const libres = [];
  for (const nom of tousEmplacements(plan)) {
    if (!pris.has(cleEmplacement(nom))) libres.push(nom);
    if (libres.length >= n) break;
  }
  return libres;
}

// ---------- Saison et suivi ----------

// Dernière entrée ou sortie d'un jeu (jeu.mouvements : la plus récente
// d'abord, ENTREE et SORTIE seulement)
const derniereEntreeSortie = (jeu) => jeu?.mouvements?.[0] || null;

// Avancement du changement de saison qui vient : jeux de cette saison posés
// depuis le début de la période, et ceux encore à l'entrepôt
export function progressionSaison(jeux, aVenir = saisonAVenir()) {
  const deSaison = jeux.filter((j) => j.saison === aVenir.saison && j.statut !== "REMIS");
  const faits = deSaison.filter((j) => {
    const m = derniereEntreeSortie(j);
    return j.statut === "POSE" && m?.type === "SORTIE" && new Date(m.date) >= aVenir.debut;
  }).length;
  const restants = deSaison.filter((j) => j.statut === "ENTREPOSE").length;
  return { faits, restants, total: faits + restants };
}

// Jeu oublié : à l'entrepôt depuis plus d'un an — le client a sauté une saison
export const JOURS_OUBLIE = 365;
export function estOublie(jeu, maintenant = new Date()) {
  if (jeu.statut !== "ENTREPOSE") return false;
  const m = derniereEntreeSortie(jeu);
  const depuis = new Date(m?.type === "ENTREE" ? m.date : jeu.creeLe);
  return maintenant.getTime() - depuis.getTime() > JOURS_OUBLIE * 86400000;
}

// Entré à l'entrepôt le… (dernière entrée), ou null
export const entreLe = (jeu) => (derniereEntreeSortie(jeu)?.type === "ENTREE" ? derniereEntreeSortie(jeu).date : null);

// ---------- Reçu d'entreposage ----------

// Conditions imprimées au bas du reçu, modifiables dans Réglages (réglage
// pneus_conditions)
export const CONDITIONS_RECU_DEFAUT =
  "Les pneus sont entreposés à l'intérieur, à l'abri des intempéries et du soleil. L'usure et l'état notés ci-dessus ont été constatés au dépôt : "
  + "l'atelier n'est pas responsable de l'usure normale ni des défauts présents au moment du dépôt. Présentez ce reçu ou donnez le numéro du jeu "
  + "pour récupérer vos pneus. Un jeu qui n'est pas réclamé plus d'un an après la fin de sa saison pourra, après un avis au client, être disposé.";

// Photos d'un jeu (à l'entrée : état des pneus et des jantes, dommages)
export const PHOTOS_MAX_JEU = 8;
export const LARGEUR_PHOTO_PNEUS = 1280;
export const QUALITE_PHOTO_PNEUS = 0.6;

// Formats d'étiquettes offerts (lib/pdfEtiquettesPieces.js) : assez grandes
// pour se lire sur un pneu
export const FORMATS_ETIQUETTES_PNEUS = [
  { code: "avery-5163", label: "Avery 5163 — 2 × 4 po, 10 par feuille", parFeuille: 10 },
  { code: "avery-5162", label: "Avery 5162 — 1⅓ × 4 po, 14 par feuille", parFeuille: 14 },
  { code: "zebra-4x2", label: "Zebra — rouleau 4 × 2 po", parFeuille: 1 },
];
