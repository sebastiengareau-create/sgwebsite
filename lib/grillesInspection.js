// Inspection numérique multipoint : grilles de départ, états d'un point et
// calculs du rapport — sans dépendance au serveur, donc utilisables aussi
// dans le navigateur (page du technicien, rapport du client). Le reste
// (lien secret, création, module) : lib/inspections.js.
//
// Grilles d'origine ci-dessous (GRILLES_ORIGINE), selon le type de véhicules
// du profil. Le garage peut les modifier dans Paramètres → Grilles
// d'inspection : ses grilles sont alors gardées dans Parametre (clé
// grilles_inspection, lue par lib/inspections.js) et remplacent celles
// d'origine. Une grille est copiée dans l'inspection à sa création
// (PointInspection) : la changer ne touche pas aux inspections déjà faites.
// Pendant l'inspection, le technicien peut aussi ajouter un point hors grille.

// États d'un point. Vide (null) : pas encore vérifié.
export const ETATS_POINT = {
  OK: { libelle: "OK", libelleClient: "Bon état", couleur: "var(--success)", fond: "var(--success-fond)" },
  SURVEILLER: { libelle: "À surveiller", libelleClient: "À surveiller", couleur: "var(--avertissement)", fond: "var(--avertissement-fond)" },
  URGENT: { libelle: "Urgent", libelleClient: "À faire maintenant", couleur: "var(--danger)", fond: "var(--danger-fond)" },
  NA: { libelle: "S. O.", libelleClient: "Sans objet", couleur: "var(--text-muted)", fond: "var(--surface-alt)" },
};

// Un point « à faire » : le client peut le voir comme travail recommandé
export const estARecommander = (point) => point.etat === "URGENT" || point.etat === "SURVEILLER";

// Mesures des pneus et des plaquettes
const MM = "mm";
const PNEU = "/32 po";

const p = (libelle, unite = null) => ({ libelle, unite });

const GRILLES_ORIGINE = [
  {
    cle: "complete",
    titre: "Inspection complète",
    types: ["auto"],
    sections: [
      { titre: "Sous le capot", points: [
        p("Huile moteur (niveau et état)"), p("Liquide de refroidissement"), p("Liquide de frein"),
        p("Liquide de servodirection"), p("Liquide de lave-glace"), p("Courroies"), p("Boyaux"),
        p("Filtre à air du moteur"), p("Batterie et bornes"), p("Fuites visibles"),
      ] },
      { titre: "Freins", points: [
        p("Plaquettes avant", MM), p("Plaquettes arrière", MM), p("Disques avant"),
        p("Disques ou tambours arrière"), p("Conduites et boyaux de frein"), p("Frein de stationnement"),
      ] },
      { titre: "Pneus et roues", points: [
        p("Pneu avant gauche", PNEU), p("Pneu avant droit", PNEU), p("Pneu arrière gauche", PNEU),
        p("Pneu arrière droit", PNEU), p("Pression des pneus"), p("Usure irrégulière (alignement)"), p("Pneu de secours"),
      ] },
      { titre: "Direction et suspension", points: [
        p("Amortisseurs et jambes de force"), p("Rotules"), p("Embouts de direction"),
        p("Bras de suspension et coussinets"), p("Biellettes de stabilisateur"), p("Roulements de roue"),
      ] },
      { titre: "Dessous du véhicule", points: [
        p("Système d'échappement"), p("Fuites (moteur, transmission, différentiel)"),
        p("Joints homocinétiques et soufflets"), p("Rouille et corrosion"), p("Supports de moteur et de transmission"),
      ] },
      { titre: "Éclairage et visibilité", points: [
        p("Phares et feux de route"), p("Feux arrière et de freinage"), p("Clignotants et feux de détresse"),
        p("Essuie-glaces"), p("Pare-brise"),
      ] },
      { titre: "Intérieur et sécurité", points: [
        p("Voyants au tableau de bord"), p("Klaxon"), p("Ceintures de sécurité"),
        p("Filtre à air de l'habitacle"), p("Climatisation et chauffage"),
      ] },
    ],
  },
  {
    cle: "vr",
    titre: "Inspection VR",
    types: ["vr"],
    sections: [
      { titre: "Moteur et châssis (motorisé)", points: [
        p("Huile moteur (niveau et état)"), p("Liquide de refroidissement"), p("Courroies et boyaux"),
        p("Batterie de démarrage"), p("Fuites visibles"), p("Système d'échappement"),
      ] },
      { titre: "Freins, pneus et roues", points: [
        p("Freins avant", MM), p("Freins arrière", MM), p("Roulements de roue"),
        p("Pneus — usure", PNEU), p("Pneus — âge (code DOT)"), p("Pression des pneus"),
      ] },
      { titre: "Toit et extérieur", points: [
        p("Membrane du toit"), p("Scellants du toit"), p("Scellants des fenêtres et ouvertures"),
        p("Auvent"), p("Marchepied"), p("Attelage et chaînes de sécurité"), p("Vérins de stabilisation"),
      ] },
      { titre: "Propane", points: [
        p("Test d'étanchéité"), p("Réservoirs ou bonbonnes (date de certification)"), p("Régulateur"),
        p("Détecteurs de propane et de monoxyde de carbone"),
      ] },
      { titre: "Électricité", points: [
        p("Batteries de service"), p("Convertisseur et chargeur"), p("Génératrice"),
        p("Prises et disjoncteurs DDFT"), p("Cordon d'alimentation"),
      ] },
      { titre: "Plomberie", points: [
        p("Pompe à eau"), p("Chauffe-eau"), p("Réservoirs d'eaux grises et noires"), p("Robinetterie et fuites"),
      ] },
      { titre: "Électroménagers et confort", points: [
        p("Réfrigérateur"), p("Cuisinière"), p("Fournaise"), p("Climatiseur"),
      ] },
      { titre: "Sécurité", points: [
        p("Détecteur de fumée"), p("Extincteur"), p("Sortie de secours"), p("Éclairage extérieur et feux"),
      ] },
    ],
  },
  {
    cle: "rapide",
    titre: "Inspection rapide",
    types: ["auto", "vr"],
    sections: [
      { titre: "Liquides et moteur", points: [
        p("Huile moteur (niveau et état)"), p("Liquide de refroidissement"), p("Liquide de lave-glace"),
        p("Batterie et bornes"), p("Fuites visibles"),
      ] },
      { titre: "Freins et pneus", points: [
        p("Plaquettes avant", MM), p("Plaquettes arrière", MM), p("Usure des pneus", PNEU), p("Pression des pneus"),
      ] },
      { titre: "Sécurité", points: [
        p("Éclairage"), p("Essuie-glaces"), p("Voyants au tableau de bord"),
      ] },
    ],
  },
];

// Grilles d'origine pour un type de véhicules (profil typeVehicules), prêtes
// à modifier : { cle, titre, active, sections: [{ titre, points: [{ libelle, unite }] }] }
export function grillesParDefaut(typeVehicules) {
  return GRILLES_ORIGINE.filter((g) => g.types.includes(typeVehicules)).map((g) => ({
    cle: g.cle,
    titre: g.titre,
    active: true,
    sections: g.sections.map((sec) => ({ titre: sec.titre, points: sec.points.map((pt) => ({ libelle: pt.libelle, unite: pt.unite || "" })) })),
  }));
}

export const nbPointsGrille = (grille) => grille.sections.reduce((n, sec) => n + sec.points.length, 0);

// Grilles offertes sur les bons : celles qui sont actives, en résumé
export function resumeGrilles(grilles) {
  return grilles.filter((g) => g.active).map((g) => ({ cle: g.cle, titre: g.titre, nbPoints: nbPointsGrille(g) }));
}

// Unités offertes pour la mesure d'un point (« » : pas d'unité)
export const UNITES_MESURE = ["", "mm", "/32 po", "lb/po²", "V", "%"];

export const LIMITES_GRILLES = { grilles: 20, sections: 30, points: 80, titreGrille: 60, titreSection: 80, libelle: 120 };

// Grilles reçues de l'éditeur (ou lues de la base), nettoyées et vérifiées
// → { grilles } ou { erreur }. Les points sans nom et les sections vides
// sont retirés en silence.
export function normaliserGrilles(brut) {
  if (!Array.isArray(brut)) return { erreur: "Grilles invalides." };
  const L = LIMITES_GRILLES;
  const texte = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const grilles = [];
  const cles = new Set();
  const titres = new Set();
  for (const g of brut) {
    const titre = texte(g?.titre, L.titreGrille);
    const cle = String(g?.cle || "");
    if (!/^[a-z0-9-]{1,40}$/.test(cle) || cles.has(cle)) return { erreur: "Grilles invalides (identifiant)." };
    if (!titre) return { erreur: "Chaque grille doit avoir un nom." };
    if (titres.has(titre.toLowerCase())) return { erreur: `Deux grilles s'appellent « ${titre} ».` };
    cles.add(cle);
    titres.add(titre.toLowerCase());

    const sections = [];
    const titresSections = new Set();
    for (const sec of Array.isArray(g.sections) ? g.sections : []) {
      const points = (Array.isArray(sec?.points) ? sec.points : [])
        .map((pt) => ({ libelle: texte(pt?.libelle, L.libelle), unite: UNITES_MESURE.includes(pt?.unite) ? pt.unite : "" }))
        .filter((pt) => pt.libelle);
      const titreSection = texte(sec?.titre, L.titreSection);
      if (!points.length) continue;
      if (!titreSection) return { erreur: `« ${titre} » : une section qui a des points doit avoir un nom.` };
      if (titresSections.has(titreSection.toLowerCase())) return { erreur: `« ${titre} » : deux sections s'appellent « ${titreSection} ».` };
      if (points.length > L.points) return { erreur: `« ${titre} » : ${L.points} points au plus par section.` };
      titresSections.add(titreSection.toLowerCase());
      sections.push({ titre: titreSection, points });
    }
    if (!sections.length) return { erreur: `« ${titre} » : la grille doit avoir au moins un point.` };
    if (sections.length > L.sections) return { erreur: `« ${titre} » : ${L.sections} sections au plus.` };
    grilles.push({ cle, titre, active: g.active !== false, sections });
  }
  if (!grilles.length) return { erreur: "Il faut au moins une grille." };
  if (grilles.length > L.grilles) return { erreur: `${L.grilles} grilles au plus.` };
  if (!grilles.some((g) => g.active)) return { erreur: "Au moins une grille doit être offerte sur les bons." };
  return { grilles };
}

// Identifiant d'une nouvelle grille (éditeur)
export function nouvelleCleGrille() {
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// États proposés selon la mesure. Pour ces unités, plus la mesure est basse,
// plus c'est urgent : à la valeur « urgent » ou moins → Urgent ; à la valeur
// « surveiller » ou moins → À surveiller ; au-dessus → OK. Une valeur vide :
// pas de proposition pour ce niveau. Modifiables dans Paramètres → Grilles
// d'inspection (lib/inspections.js, clé seuils_inspection). Pression et
// pourcentages n'en ont pas : la bonne valeur dépend du véhicule.
export const SEUILS_DEFAUT = {
  mm: { urgent: 3, surveiller: 5 }, // plaquettes de frein
  "/32 po": { urgent: 2, surveiller: 4 }, // usure des pneus (2/32 po : limite légale au Canada)
  V: { urgent: 12, surveiller: 12.3 }, // batterie au repos
};
export const UNITES_AVEC_SEUILS = Object.keys(SEUILS_DEFAUT);

const nombreFr = (n) => String(n).replace(".", ",");

// Premier nombre d'une mesure (« 3 », « 3,5 », « 4/32 », « 12.6 V ») ou null
export function lireNombre(mesure) {
  const m = String(mesure ?? "").match(/\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : null;
}

// État proposé pour une mesure → { etat, regle } (regle : « 3 mm ou moins »),
// ou null : pas de mesure lisible, ou pas de seuil pour cette unité
export function etatPropose(mesure, unite, seuils = SEUILS_DEFAUT) {
  const s = seuils?.[unite];
  const n = lireNombre(mesure);
  if (!s || n === null) return null;
  const regle = (v) => `${avecUnite(nombreFr(v), unite)} ou moins`;
  if (s.urgent != null && n <= s.urgent) return { etat: "URGENT", regle: regle(s.urgent) };
  if (s.surveiller != null && n <= s.surveiller) return { etat: "SURVEILLER", regle: regle(s.surveiller) };
  if (s.urgent == null && s.surveiller == null) return null;
  return { etat: "OK", regle: `plus de ${avecUnite(nombreFr(s.surveiller ?? s.urgent), unite)}` };
}

// Seuils reçus de l'éditeur (ou lus de la base) → { seuils } ou { erreur }
export function normaliserSeuils(brut) {
  const seuils = {};
  for (const unite of UNITES_AVEC_SEUILS) {
    const valeur = (v) => {
      if (v === "" || v == null) return null;
      const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
      return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) / 100 : NaN;
    };
    const urgent = valeur(brut?.[unite]?.urgent);
    const surveiller = valeur(brut?.[unite]?.surveiller);
    if (Number.isNaN(urgent) || Number.isNaN(surveiller)) return { erreur: `Seuils en ${unite} : entre un nombre (ou laisse vide).` };
    if (urgent != null && surveiller != null && urgent >= surveiller) {
      return { erreur: `Seuils en ${unite} : la valeur « urgent » doit être plus basse que « à surveiller ».` };
    }
    seuils[unite] = { urgent, surveiller };
  }
  return { seuils };
}

// Mesure avec son unité : « 3 mm », « 4/32 po »
export function avecUnite(mesure, unite) {
  if (!mesure) return "";
  if (!unite) return mesure;
  return unite.startsWith("/") ? `${mesure}${unite}` : `${mesure} ${unite}`;
}

// Points d'une grille, prêts à créer (ordre continu d'une section à l'autre)
export function pointsDeGrille(grille) {
  let ordre = 0;
  return grille.sections.flatMap((s) => s.points.map((pt) => ({ section: s.titre, libelle: pt.libelle, unite: pt.unite || null, ordre: (ordre += 10) })));
}

// Points regroupés par section, dans l'ordre de l'inspection
export function parSection(points) {
  const sections = [];
  for (const pt of [...points].sort((a, b) => a.ordre - b.ordre)) {
    let s = sections.find((x) => x.titre === pt.section);
    if (!s) sections.push((s = { titre: pt.section, points: [] }));
    s.points.push(pt);
  }
  return sections;
}

// Décompte des états : { OK, SURVEILLER, URGENT, NA, aVerifier, total }
export function resume(points) {
  const r = { OK: 0, SURVEILLER: 0, URGENT: 0, NA: 0, aVerifier: 0, total: points.length };
  for (const pt of points) {
    if (pt.etat && r[pt.etat] !== undefined) r[pt.etat]++;
    else r.aVerifier++;
  }
  return r;
}

// Travaux recommandés montrés au client : urgents d'abord, puis à
// surveiller, chacun dans l'ordre de l'inspection
export function pointsRecommandes(points) {
  const rang = { URGENT: 0, SURVEILLER: 1 };
  return points
    .filter((pt) => estARecommander(pt) && pt.recommandation?.trim())
    .sort((a, b) => rang[a.etat] - rang[b.etat] || a.ordre - b.ordre);
}

// Le client peut encore répondre : rapport terminé, pas déjà répondu, et au
// moins un travail recommandé
export function peutRepondreInspection(inspection, points = inspection.points) {
  return inspection.statut === "TERMINEE" && !inspection.reponseClient && pointsRecommandes(points).length > 0;
}

// Montants des travaux retenus (prix estimés avant taxes ; un travail sans
// prix compte dans aPrixAConfirmer, pas dans le total)
export function totauxRecommandes(points, { tpsTaux, tvqTaux }) {
  const sousTotal = points.reduce((s, pt) => s + (pt.prixEstime || 0), 0);
  const tps = sousTotal * (tpsTaux / 100);
  const tvq = sousTotal * (tvqTaux / 100);
  return { sousTotal, tps, tvq, total: sousTotal + tps + tvq, aPrixAConfirmer: points.filter((pt) => pt.prixEstime == null).length };
}

// Où en est l'inspection, en un mot (carte du bon, liste)
export function etapeInspection(inspection) {
  if (inspection.statut !== "TERMINEE") return { libelle: "En cours", couleur: "var(--bleu)" };
  if (inspection.reponseClient === "APPROUVEE") return { libelle: "Approuvée par le client", couleur: "var(--success)" };
  if (inspection.reponseClient === "REFUSEE") return { libelle: "Refusée par le client", couleur: "var(--danger)" };
  if (inspection.envoyeeLe) return { libelle: "Envoyée au client", couleur: "var(--accent-ombre)" };
  return { libelle: "Terminée", couleur: "var(--accent-ombre)" };
}
