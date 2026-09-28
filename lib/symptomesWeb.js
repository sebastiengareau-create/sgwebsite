// Option « Dites-nous les symptômes » du site de réservation (Calendrier →
// Paramètres web) : toujours offerte en dernier, après les services. Le
// client coche les voyants allumés au tableau de bord et les symptômes de
// sa voiture. Réglages gardés dans Parametre (clé ci-dessous, en JSON).
const CLE = "reservation_symptomes";
const LONGUEUR_MAX_TEXTE = 200;
const LONGUEUR_MAX_SYMPTOME = 40;
const NB_MAX_SYMPTOMES = 20;

// Voyants offerts — icônes dans public/voyants/
const VOYANTS = [
  { id: "coussin-gonflable", nom: "Coussin gonflable" },
  { id: "batterie", nom: "Batterie" },
  { id: "moteur", nom: "Moteur (Check engine)" },
  { id: "temperature", nom: "Température du moteur" },
  { id: "entretien", nom: "Entretien requis" },
  { id: "pression-pneus", nom: "Pression des pneus" },
  { id: "abs", nom: "ABS (freins)" },
];

const DEFAUT = {
  actif: false,
  nom: "Dites-nous les symptômes",
  description: "Un voyant allumé ou un comportement inhabituel ? On s'occupe du diagnostic.",
  dureeMinutes: 60,
  voyants: VOYANTS.map((v) => v.id),
  symptomes: ["Tremblement", "Traction", "Vibration", "Bruit", "Fuite", "Fumée", "Odeur", "Difficulté à démarrer"],
};

function iconeVoyant(id) {
  return `/voyants/${id}.svg`;
}

async function chargerSymptomes(prisma) {
  const ligne = await prisma.parametre.findUnique({ where: { cle: CLE } });
  let enregistre = {};
  try { enregistre = ligne ? JSON.parse(ligne.valeur) : {}; } catch { enregistre = {}; }
  return { ...DEFAUT, ...enregistre };
}

async function enregistrerSymptomes(prisma, reglages) {
  const valeur = JSON.stringify(reglages);
  await prisma.parametre.upsert({ where: { cle: CLE }, update: { valeur }, create: { cle: CLE, valeur } });
}

// Valide une modification (champs reçus seulement) → { data } ou { erreur }
function validerSymptomes(corps, { DUREE_MIN, DUREE_MAX }) {
  const data = {};
  if (corps.actif !== undefined) data.actif = corps.actif === true;
  if (corps.nom !== undefined) {
    const nom = String(corps.nom || "").trim();
    if (!nom) return { erreur: "Indique le titre de l'option." };
    if (nom.length > 80) return { erreur: "Titre trop long (80 caractères maximum)." };
    data.nom = nom;
  }
  if (corps.description !== undefined) {
    const description = String(corps.description || "").trim();
    if (description.length > LONGUEUR_MAX_TEXTE) return { erreur: `Description trop longue (${LONGUEUR_MAX_TEXTE} caractères maximum).` };
    data.description = description;
  }
  if (corps.dureeMinutes !== undefined) {
    const duree = Number(corps.dureeMinutes);
    if (!Number.isInteger(duree) || duree < DUREE_MIN || duree > DUREE_MAX) {
      return { erreur: `Durée invalide (${DUREE_MIN} à ${DUREE_MAX} minutes).` };
    }
    data.dureeMinutes = duree;
  }
  if (corps.voyants !== undefined) {
    if (!Array.isArray(corps.voyants)) return { erreur: "Liste de voyants invalide." };
    // Garde l'ordre du tableau de bord, peu importe l'ordre reçu
    data.voyants = VOYANTS.map((v) => v.id).filter((id) => corps.voyants.includes(id));
  }
  if (corps.symptomes !== undefined) {
    if (!Array.isArray(corps.symptomes)) return { erreur: "Liste de symptômes invalide." };
    const vus = new Set();
    const symptomes = [];
    for (const s of corps.symptomes) {
      const texte = String(s || "").trim();
      if (!texte || vus.has(texte.toLowerCase())) continue;
      if (texte.length > LONGUEUR_MAX_SYMPTOME) return { erreur: `Symptôme trop long (${LONGUEUR_MAX_SYMPTOME} caractères maximum).` };
      vus.add(texte.toLowerCase());
      symptomes.push(texte);
    }
    if (symptomes.length > NB_MAX_SYMPTOMES) return { erreur: `${NB_MAX_SYMPTOMES} symptômes maximum.` };
    data.symptomes = symptomes;
  }
  return { data };
}

// Ce que le site reçoit, en dernière entrée de la liste des services.
// base : adresse du logiciel, pour des liens d'icônes complets.
function symptomesPourSite(reglages, base) {
  return {
    id: "symptomes",
    type: "symptomes",
    nom: reglages.nom,
    description: reglages.description || null,
    dureeMinutes: reglages.dureeMinutes,
    voyants: VOYANTS.filter((v) => reglages.voyants.includes(v.id)).map((v) => ({
      id: v.id,
      nom: v.nom,
      icone: base ? new URL(iconeVoyant(v.id), base).toString() : iconeVoyant(v.id),
    })),
    symptomes: reglages.symptomes,
  };
}

// Texte ajouté au motif du rendez-vous à partir de ce que le client a coché
// (voyants : identifiants ou noms). → "" si rien.
function resumeSymptomes({ voyants, symptomes }) {
  const listeVoyants = (Array.isArray(voyants) ? voyants : [])
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .map((v) => VOYANTS.find((x) => x.id === v)?.nom || v.slice(0, LONGUEUR_MAX_SYMPTOME))
    .slice(0, VOYANTS.length);
  const listeSymptomes = (Array.isArray(symptomes) ? symptomes : [])
    .map((s) => (typeof s === "string" ? s.trim().slice(0, LONGUEUR_MAX_SYMPTOME) : ""))
    .filter(Boolean)
    .slice(0, NB_MAX_SYMPTOMES);
  const parties = [];
  if (listeVoyants.length) parties.push(`Voyants allumés : ${listeVoyants.join(", ")}`);
  if (listeSymptomes.length) parties.push(`Symptômes : ${listeSymptomes.join(", ")}`);
  return parties.join(" · ");
}

module.exports = {
  VOYANTS, iconeVoyant, chargerSymptomes, enregistrerSymptomes, validerSymptomes, symptomesPourSite, resumeSymptomes,
};
