// Inspection numérique multipoint : grilles de départ, états d'un point et
// calculs du rapport — sans dépendance au serveur, donc utilisables aussi
// dans le navigateur (page du technicien, rapport du client). Le reste
// (lien secret, création, module) : lib/inspections.js.
//
// Une grille est copiée dans l'inspection à sa création (PointInspection) :
// la changer ici ne touche pas aux inspections déjà faites. Pendant
// l'inspection, le technicien peut aussi ajouter un point hors grille.

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

const GRILLES = [
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

// Grilles offertes pour un type de véhicules (profil typeVehicules)
export function grillesPour(typeVehicules) {
  return GRILLES.filter((g) => g.types.includes(typeVehicules)).map(({ cle, titre, sections }) => ({
    cle, titre, nbPoints: sections.reduce((n, s) => n + s.points.length, 0),
  }));
}

export function trouverGrille(cle) {
  return GRILLES.find((g) => g.cle === cle) || null;
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
  return grille.sections.flatMap((s) => s.points.map((pt) => ({ section: s.titre, libelle: pt.libelle, unite: pt.unite, ordre: (ordre += 10) })));
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
