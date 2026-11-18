// Immobilier de démonstration (Administrateur → Immobilier de démonstration) :
// un petit parc locatif complet pour présenter le module Immobilier — un
// triplex, un sixplex et un immeuble mixte (deux commerces, deux logements),
// 13 logements dont un vacant, leurs locataires (colocataires, commerces),
// des baux à chaque étape (en cours, avis de modification à envoyer, avis
// envoyé en attente de réponse, locataire qui quitte, fin dépassée à
// renouveler, durée indéterminée, baux précédents terminés), douze mois de
// loyers et de paiements (un locataire en retard de deux mois, un paiement
// partiel, un retardataire), un an de dépenses, des réparations à chaque
// étape et des documents : ceux que l'appli génère (avis de modification,
// rappel de retard, avis d'accès, état des lieux, fiches de bail) et ceux
// qu'on y dépose (assurance qui expire bientôt, taxes, contrats…).
//
// Les dates sont calculées à partir d'aujourd'hui : la démonstration montre
// les mêmes situations quel que soit le jour où on la charge.
//
// Chargée seulement dans un parc vide. Ce qui est créé est noté dans le
// paramètre « immobilier_demo » : « Retirer » efface les immeubles avec tout
// ce qui s'y rattache — y compris ce qui a été ajouté pendant les essais —
// et leurs locataires, sans toucher à un vrai immeuble ajouté à côté.

import PDFDocument from "pdfkit";
import { prisma } from "./prisma";
import { creerReparation, genererDocumentBail, nouveauJeton } from "./immobilier";
import { loyerDuMois, periodeLisible, ajouterMois } from "./immobilierCalculs";

export const AUTEUR_IMMO_DEMO = "Démonstration";
const CLE = "immobilier_demo";
const JOUR = 86400000;

// ---------- Outils de dates (midi UTC, comme toutes les dates du module) ----------

const midi = (d) => new Date(`${new Date(d).toISOString().slice(0, 10)}T12:00:00Z`);
const ilYA = (n) => midi(Date.now() - n * JOUR);
// Dernier jour du mois courant + k mois
function finMois(k) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k + 1, 0, 12));
}
// Prochain 30 juin (fin habituelle des baux au Québec)
function prochain30Juin() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear(), 5, 30, 12));
}
// Début d'un bail de n mois qui finit à cette date
const debutPour = (fin, mois = 12) => ajouterMois(new Date(fin.getTime() + JOUR), -mois);
const veille = (d) => new Date(d.getTime() - JOUR);
function periodeIlYA(n) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1, 12)).toISOString().slice(0, 7);
}
const arrondi = (n) => Math.round(n * 100) / 100;
// Hasard reproductible : la démonstration est la même à chaque chargement
function hasard(graine) {
  let x = graine;
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
}

// ---------- Données ----------

const IMMEUBLES = [
  {
    cle: "champlain", nom: "Triplex Champlain", adresse: "312-316 rue Champlain", ville: "Saint-Jean-sur-Richelieu", codePostal: "J3B 6V5", type: "PLEX",
    anneeConstruction: 1962, dateAchat: ilYA(2600), prixAchat: 389000, evaluationMunicipale: 455000, valeurEstimee: 525000, soldeHypotheque: 268400,
    notes: "Toiture refaite en 2021. Chauffe-eau du 312 à remplacer d'ici deux ans.",
    logements: [["312", "LOGEMENT", "5 ½", "RC", 1050], ["314", "LOGEMENT", "4 ½", "2", 900], ["316", "LOGEMENT", "4 ½", "3", 900]],
  },
  {
    cle: "erables", nom: "Sixplex des Érables", adresse: "85 rue des Érables", ville: "Chambly", codePostal: "J3L 2K8", type: "MULTILOGEMENT",
    anneeConstruction: 1988, dateAchat: ilYA(1750), prixAchat: 875000, evaluationMunicipale: 912000, valeurEstimee: 1040000, soldeHypotheque: 692000,
    notes: "Stationnement de 8 places, laveuse et sécheuse communes au sous-sol.",
    logements: [["1", "LOGEMENT", "3 ½", "RC", 640], ["2", "LOGEMENT", "4 ½", "RC", 820], ["3", "LOGEMENT", "3 ½", "2", 640], ["4", "LOGEMENT", "4 ½", "2", 820], ["5", "LOGEMENT", "4 ½", "3", 820], ["6", "LOGEMENT", "3 ½", "3", 640]],
  },
  {
    cle: "richelieu", nom: "Édifice Richelieu", adresse: "220 rue Richelieu", ville: "Saint-Jean-sur-Richelieu", codePostal: "J3B 6Y3", type: "MIXTE",
    anneeConstruction: 1925, dateAchat: ilYA(900), prixAchat: 1150000, evaluationMunicipale: 1085000, valeurEstimee: 1240000, soldeHypotheque: 905000,
    notes: "Bâtiment patrimonial du Vieux-Saint-Jean : travaux de façade soumis à l'approbation de la Ville.",
    logements: [["Local A", "COMMERCIAL", null, "RC", 1400], ["Local B", "COMMERCIAL", null, "RC", 1100], ["201", "LOGEMENT", "5 ½", "2", 1150], ["202", "LOGEMENT", "4 ½", "2", 950]],
  },
];

// Locataires : les adresses et numéros sont fictifs
const LOCATAIRES = {
  tremblay: { nom: "Marie-Ève Tremblay", courriel: "marieeve.tremblay@example.com", telephone: "450-555-0101" },
  gagnon: { nom: "Olivier Gagnon", courriel: "olivier.gagnon@example.com", telephone: "450-555-0102" },
  roy: { nom: "Jean-François Roy", courriel: "jf.roy@example.com", telephone: "450-555-0103" },
  lavoie: { nom: "Sophie Lavoie", courriel: "sophie.lavoie@example.com", telephone: "514-555-0104", notes: "Paie souvent avec quelques jours de retard ; toujours réglé dans le mois." },
  bouchard: { nom: "Kevin Bouchard", courriel: "kevin.bouchard@example.com", telephone: "450-555-0105", notes: "Deux loyers en retard — entente de paiement à proposer avant de déposer une demande au TAL." },
  cote: { nom: "Amélie Côté", courriel: "amelie.cote@example.com", telephone: "450-555-0106" },
  morin: { nom: "Gilles Morin", telephone: "450-555-0107", contactUrgence: "Hélène Morin (fille) — 450-555-0177", notes: "Locataire depuis 2004. Paie par chèque." },
  benali: { nom: "Nadia Benali", courriel: "nadia.benali@example.com", telephone: "438-555-0108" },
  ouellet: { nom: "Patrick Ouellet", courriel: "patrick.ouellet@example.com", telephone: "450-555-0109" },
  simard: { nom: "Julie Simard", courriel: "julie.simard@example.com", telephone: "450-555-0110" },
  gauthier: { nom: "Laurence Gauthier", courriel: "laurence.gauthier@example.com", telephone: "514-555-0111" },
  cafe: { nom: "Café Le Vieux-Moulin inc.", courriel: "info@cafevieuxmoulin.example", telephone: "450-555-0112", contactUrgence: "Martin Leduc, propriétaire — 450-555-0182" },
  yoga: { nom: "Studio Yoga Rive inc.", courriel: "bonjour@yogarive.example", telephone: "450-555-0113" },
  pelletier: { nom: "Mathieu Pelletier", courriel: "mathieu.pelletier@example.com", telephone: "450-555-0114" },
  dube: { nom: "Caroline Dubé", courriel: "caroline.dube@example.com", telephone: "450-555-0115", notes: "Ancienne locataire du 202 (partie à la fin de son bail)." },
};

// Retards de paiement voulus : periodesImpayees (rangs : 0 = mois courant),
// partiel (fraction payée du mois courant), delai (jours après l'échéance)
// Baux de chaque logement : [cle logement, scénario]
function scenarios() {
  const juin = prochain30Juin();
  return [
    // Triplex Champlain
    ["champlain/312", { locataires: ["tremblay", "gagnon"], fin: juin, loyer: 1450, precedent: 1395, services: "CHAUFFAGE,EAU_CHAUDE,STATIONNEMENT", mode: "VIREMENT" }],
    ["champlain/314", { locataires: ["roy"], fin: finMois(4), loyer: 1150, precedent: 1110, services: "EAU_CHAUDE,ELECTROMENAGERS", mode: "VIREMENT", note: "Avis de modification à envoyer : hausse visée de 4,5 %." }],
    ["champlain/316", { locataires: ["lavoie"], fin: juin, loyer: 1095, precedent: 1060, services: "EAU_CHAUDE", mode: "VIREMENT", delai: [5, 9], periodesImpayees: [0] }],
    // Sixplex des Érables
    ["erables/1", { locataires: ["bouchard"], fin: juin, loyer: 925, precedent: 895, services: "CHAUFFAGE,EAU_CHAUDE,LAVEUSE_SECHEUSE", mode: "VIREMENT", periodesImpayees: [0, 1] }],
    ["erables/2", { locataires: ["cote"], fin: finMois(5), loyer: 995, precedent: 965, services: "CHAUFFAGE,EAU_CHAUDE,LAVEUSE_SECHEUSE,STATIONNEMENT", mode: "PREAUTORISE", avis: { il_y_a: 9, nouveauLoyer: 1040 } }],
    ["erables/3", { locataires: ["morin"], indetermine: true, debut: ilYA(8000), loyer: 780, services: "CHAUFFAGE,EAU_CHAUDE,LAVEUSE_SECHEUSE", mode: "CHEQUE", note: "Bail à durée indéterminée depuis la fin de son bail de 2004." }],
    ["erables/4", { locataires: ["benali"], fin: finMois(4), loyer: 1010, precedent: 980, services: "CHAUFFAGE,EAU_CHAUDE,LAVEUSE_SECHEUSE", mode: "VIREMENT", avis: { il_y_a: 34, nouveauLoyer: 1050, reponse: "QUITTE" }, note: "Quitte à la fin du bail : logement à afficher." }],
    ["erables/5", { locataires: ["ouellet", "simard"], fin: finMois(-1), loyer: 1030, precedent: 1000, services: "CHAUFFAGE,EAU_CHAUDE,LAVEUSE_SECHEUSE,STATIONNEMENT", mode: "VIREMENT", avis: { il_y_a: 190, nouveauLoyer: 1065, reponse: "ACCEPTE" }, note: "Nouveau loyer accepté : renouvellement à inscrire." }],
    ["erables/6", { locataires: ["gauthier"], fin: juin, loyer: 860, precedent: 835, services: "CHAUFFAGE,EAU_CHAUDE,LAVEUSE_SECHEUSE", mode: "VIREMENT", partiel: 0.5 }],
    // Édifice Richelieu
    ["richelieu/Local A", { locataires: ["cafe"], debut: ilYA(1100), mois: 60, loyer: 3200, mode: "PREAUTORISE", jourPaiement: 1, note: "Bail commercial de 5 ans, net : taxes foncières refacturées au prorata de la superficie." }],
    ["richelieu/Local B", { locataires: ["yoga"], debut: ilYA(500), mois: 36, loyer: 2400, mode: "PREAUTORISE", note: "Bail commercial de 3 ans avec option de renouvellement de 3 ans." }],
    ["richelieu/201", { locataires: ["pelletier"], fin: juin, loyer: 1450, precedent: 1400, services: "ELECTROMENAGERS", mode: "VIREMENT" }],
    // 202 : vacant depuis la fin du bail de Caroline Dubé
    ["richelieu/202", { locataires: ["dube"], fin: finMois(-2), loyer: 1150, termine: true, services: "ELECTROMENAGERS", mode: "CHEQUE" }],
  ];
}

// [immeuble, catégorie, description, montant, payé à, rangs des mois (0 = ce mois-ci), jour du mois]
const DEPENSES_MENSUELLES = [
  ["champlain", "INTERETS", "Intérêts hypothécaires", 1095, "Caisse Desjardins du Haut-Richelieu", 1],
  ["erables", "INTERETS", "Intérêts hypothécaires", 2350, "Banque Nationale", 1],
  ["richelieu", "INTERETS", "Intérêts hypothécaires", 3100, "Caisse Desjardins du Haut-Richelieu", 1],
  ["erables", "ELECTRICITE", "Hydro-Québec — aires communes", 118, "Hydro-Québec", 12],
  ["erables", "CHAUFFAGE", "Chauffage central (mazout et électricité)", 520, "Énergies Sonic", 20],
  ["richelieu", "ELECTRICITE", "Hydro-Québec — aires communes", 64, "Hydro-Québec", 12],
  ["champlain", "CHAUFFAGE", "Hydro-Québec — chauffage du 312", 210, "Hydro-Québec", 12],
];
// [immeuble, catégorie, description, montant, payé à, il y a n jours]
const DEPENSES_PONCTUELLES = [
  ["champlain", "TAXES_MUNICIPALES", "Taxes municipales — 1er versement", 2310, "Ville de Saint-Jean-sur-Richelieu", 230],
  ["champlain", "TAXES_MUNICIPALES", "Taxes municipales — 2e versement", 2310, "Ville de Saint-Jean-sur-Richelieu", 140],
  ["erables", "TAXES_MUNICIPALES", "Taxes municipales — 1er versement", 4880, "Ville de Chambly", 225],
  ["erables", "TAXES_MUNICIPALES", "Taxes municipales — 2e versement", 4880, "Ville de Chambly", 135],
  ["richelieu", "TAXES_MUNICIPALES", "Taxes municipales — 1er versement", 6120, "Ville de Saint-Jean-sur-Richelieu", 230],
  ["richelieu", "TAXES_MUNICIPALES", "Taxes municipales — 2e versement", 6120, "Ville de Saint-Jean-sur-Richelieu", 140],
  ["champlain", "TAXES_SCOLAIRES", "Taxe scolaire", 465, "Centre de services scolaire des Hautes-Rivières", 110],
  ["erables", "TAXES_SCOLAIRES", "Taxe scolaire", 930, "Centre de services scolaire des Patriotes", 110],
  ["richelieu", "TAXES_SCOLAIRES", "Taxe scolaire", 1105, "Centre de services scolaire des Hautes-Rivières", 110],
  ["champlain", "ASSURANCE", "Assurance des propriétaires occupants — prime annuelle", 2480, "Assurances Richelieu (fictif)", 340],
  ["erables", "ASSURANCE", "Assurance de l'immeuble — prime annuelle", 5960, "Assurances Richelieu (fictif)", 190],
  ["richelieu", "ASSURANCE", "Assurance de l'immeuble — prime annuelle", 8740, "Assurances Richelieu (fictif)", 60],
  ["erables", "DENEIGEMENT", "Contrat de déneigement — 1er versement", 1150, "Déneigement Chambly", 20],
  ["erables", "DENEIGEMENT", "Contrat de déneigement — dernier versement (saison passée)", 1150, "Déneigement Chambly", 240],
  ["champlain", "DENEIGEMENT", "Contrat de déneigement — saison", 980, "Déneigement Lacroix", 18],
  ["erables", "ENTRETIEN", "Ménage des aires communes (aux deux semaines)", 1440, "Ménage Impeccable", 45],
  ["erables", "ENTRETIEN", "Tonte de pelouse — saison", 1350, "Paysagement Vert-Tige", 80],
  ["richelieu", "GESTION", "Publicité — logement 202 à louer", 89, "Kijiji / Marketplace", 25],
  ["richelieu", "HONORAIRES", "Notaire — renouvellement hypothécaire", 1250, "Me Lucie Bérubé, notaire", 150],
  ["champlain", "HONORAIRES", "Comptable — déclaration des revenus de location", 650, "Cabinet Paquette CPA", 200],
];

// [immeuble/logement ou null, titre, catégorie, priorité, statut, il y a n jours, extra]
const REPARATIONS = [
  ["erables/4", "Robinet de la cuisine qui coule", "PLOMBERIE", "NORMALE", "NOUVELLE", 2, { locataire: "benali", portail: true, description: "Le robinet de la cuisine goutte en continu depuis la fin de semaine." }],
  ["champlain/316", "Fenêtre de la chambre qui ne ferme plus", "ENVELOPPE", "HAUTE", "NOUVELLE", 1, { locataire: "lavoie", portail: true, reponse: "Merci de nous avoir avisés. Un menuisier passera dans deux jours vers 9 h : vous recevrez l'avis d'accès dans votre espace.", description: "Le mécanisme à manivelle est brisé ; de l'air froid entre la nuit." }],
  ["erables/1", "Plinthe électrique du salon hors d'usage", "CHAUFFAGE", "URGENTE", "PLANIFIEE", 3, { locataire: "bouchard", portail: true, reponse: "L'électricien passe demain matin. D'ici là, un chauffage d'appoint est disponible au sous-sol (clé chez le concierge).", entrepreneur: "Électricité Brodeur", telephoneEntrepreneur: "450-555-0201", datePrevue: -1, coutEstime: 280 }],
  ["erables", "Nettoyage des conduits de sécheuse communs", "SECURITE", "NORMALE", "PLANIFIEE", 15, { entrepreneur: "Ventilation Rive-Sud", telephoneEntrepreneur: "450-555-0202", datePrevue: -9, coutEstime: 350 }],
  ["richelieu", "Réfection des marches de l'entrée principale", "ENVELOPPE", "HAUTE", "EN_COURS", 21, { entrepreneur: "Maçonnerie Patrimoine", telephoneEntrepreneur: "450-555-0203", datePrevue: 4, coutEstime: 4800, description: "Marches de béton fissurées ; pierre d'origine à conserver (exigence de la Ville)." }],
  ["richelieu/202", "Peinture et réparations avant la relocation", "PEINTURE", "NORMALE", "EN_COURS", 30, { entrepreneur: "Peinture Pro-Finition", telephoneEntrepreneur: "450-555-0204", datePrevue: 6, coutEstime: 2200 }],
  ["champlain/312", "Remplacement du chauffe-eau", "PLOMBERIE", "HAUTE", "TERMINEE", 75, { locataire: "tremblay", entrepreneur: "Plomberie Richelieu", telephoneEntrepreneur: "450-555-0205", datePrevue: 70, dateFin: 70, coutEstime: 1600, coutReel: 1745, numeroFacture: "PR-20418" }],
  ["erables/6", "Extermination — souris", "PARASITES", "HAUTE", "TERMINEE", 120, { locataire: "gauthier", entrepreneur: "Extermination Maheu", telephoneEntrepreneur: "450-555-0206", datePrevue: 116, dateFin: 102, coutEstime: 450, coutReel: 520, numeroFacture: "EM-7751", notes: "Deux visites ; logements 5 et 6 traités par précaution." }],
  ["champlain", "Nettoyage des gouttières", "TOITURE", "BASSE", "TERMINEE", 40, { entrepreneur: "Toitures Haut-Richelieu", telephoneEntrepreneur: "450-555-0207", datePrevue: 33, dateFin: 33, coutReel: 240, numeroFacture: "THR-1102" }],
  ["richelieu/Local A", "Remplacement du ventilateur de la hotte", "AUTRE", "NORMALE", "ANNULEE", 50, { locataire: "cafe", notes: "À la charge du locataire selon son bail commercial (équipement du café)." }],
];

// ---------- Paramètre et état ----------

async function lireIds() {
  const p = await prisma.parametre.findUnique({ where: { cle: CLE } });
  if (!p) return null;
  let ids;
  try { ids = JSON.parse(p.valeur); } catch { return null; }
  const [immeubles, locataires] = await Promise.all([
    prisma.immeubleImmo.count({ where: { id: { in: ids.immeubles || [] } } }),
    prisma.locataireImmo.count({ where: { id: { in: ids.locataires || [] } } }),
  ]);
  return immeubles + locataires > 0 ? ids : null;
}
const noterIds = (ids) => prisma.parametre.upsert({ where: { cle: CLE }, update: { valeur: JSON.stringify(ids) }, create: { cle: CLE, valeur: JSON.stringify(ids) } });

async function contenu() {
  const [immeubles, locataires] = await Promise.all([prisma.immeubleImmo.count(), prisma.locataireImmo.count()]);
  return { immeubles, locataires };
}

// → { charge, immeubles, logements (de démonstration), vide }
export async function etatImmoDemo() {
  const [ids, c] = await Promise.all([lireIds(), contenu()]);
  return {
    charge: !!ids,
    immeubles: ids ? await prisma.immeubleImmo.count({ where: { id: { in: ids.immeubles } } }) : 0,
    logements: ids ? await prisma.logementImmo.count({ where: { immeubleId: { in: ids.immeubles } } }) : 0,
    vide: c.immeubles === 0 && c.locataires === 0,
  };
}

// Petit PDF d'une page, pour que les documents s'ouvrent vraiment
function pdf(titre, lignes) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 64 });
    const morceaux = [];
    doc.on("data", (m) => morceaux.push(m));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);
    doc.fontSize(10).fillColor("#888888").text("Gestion locative — document de démonstration (personnes et adresses fictives)");
    doc.moveDown(1.5).fontSize(20).fillColor("#000000").text(titre);
    doc.moveDown(1).fontSize(11);
    for (const ligne of lignes) doc.text(ligne, { paragraphGap: 8 });
    doc.end();
  });
}
const nomFichier = (titre) => `${titre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
const date = (d) => new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
const dollars = (n) => `${n.toFixed(2).replace(".", ",")} $`;

// ---------- Chargement ----------

// → { immeubles, logements, locataires, reparations } ou { erreur }
export async function chargerImmoDemo() {
  if (await lireIds()) return { erreur: "L'immobilier de démonstration est déjà chargé." };
  if (Object.values(await contenu()).some((n) => n > 0)) return { erreur: "Le module contient déjà des immeubles ou des locataires : l'immobilier de démonstration ne se charge que dans un parc vide." };

  const ids = { immeubles: [], locataires: [] };
  try {
    await noterIds(ids);
    const immeubles = {};
    const logements = {};
    for (const { cle, logements: liste, ...data } of IMMEUBLES) {
      const i = await prisma.immeubleImmo.create({ data });
      ids.immeubles.push(i.id);
      immeubles[cle] = i;
      for (const [numero, type, pieces, etage, superficie] of liste) {
        logements[`${cle}/${numero}`] = await prisma.logementImmo.create({ data: { immeubleId: i.id, numero, type, pieces, etage, superficie } });
      }
    }
    await noterIds(ids);
    await prisma.logementImmo.update({ where: { id: logements["richelieu/202"].id }, data: { loyerVise: 1225, notes: "Vacant : rafraîchi (peinture) avant les visites. Affiché à 1 225 $." } });
    await prisma.logementImmo.update({ where: { id: logements["erables/4"].id }, data: { loyerVise: 1075 } });
    // Relevé 31 : numéros de logement (case A, fictifs) — deux laissés vides
    // pour montrer ce qui reste à compléter — et adresse propre à chaque
    // logement du triplex
    let rang = 0;
    for (const [cle, l] of Object.entries(logements)) {
      rang += 1;
      if (l.type !== "LOGEMENT") continue;
      const data = {};
      if (!["champlain/316", "erables/6"].includes(cle)) data.numeroLogementRq = String(4700000000 + rang * 7919);
      if (cle.startsWith("champlain/")) data.adresseCivique = `${l.numero} rue Champlain`;
      await prisma.logementImmo.update({ where: { id: l.id }, data });
    }

    const locataires = {};
    for (const [cle, data] of Object.entries(LOCATAIRES)) {
      locataires[cle] = await prisma.locataireImmo.create({ data });
      ids.locataires.push(locataires[cle].id);
    }
    await noterIds(ids);

    // Baux (et le bail précédent, terminé), loyers des douze derniers mois
    const periodes = Array.from({ length: 12 }, (_, i) => periodeIlYA(11 - i));
    const charges = [];
    const paiements = [];
    const baux = {};
    const alea = hasard(42);
    for (const [cleLogement, s] of scenarios()) {
      const logement = logements[cleLogement];
      const connect = s.locataires.map((c) => ({ id: locataires[c].id }));
      const commun = { logementId: logement.id, services: s.services || null, jourPaiement: s.jourPaiement || 1, locataires: { connect } };
      const liste = [];
      if (s.indetermine) {
        liste.push(await prisma.bailImmo.create({ data: { ...commun, dateDebut: s.debut, dateFin: null, loyer: s.loyer, notes: s.note } }));
      } else {
        const fin = s.fin || veille(ajouterMois(s.debut, s.mois));
        const debut = s.debut || debutPour(fin, s.mois || 12);
        if (s.precedent) {
          liste.push(await prisma.bailImmo.create({ data: { ...commun, dateDebut: debutPour(veille(debut)), dateFin: veille(debut), loyer: s.precedent, statut: "TERMINE" } }));
        }
        liste.push(await prisma.bailImmo.create({
          data: {
            ...commun, dateDebut: midi(debut), dateFin: midi(fin), loyer: s.loyer, statut: s.termine ? "TERMINE" : "ACTIF", notes: s.note || null,
            ...(s.termine ? { terminaisonLe: midi(fin) } : {}),
            ...(s.avis ? { avisEnvoyeLe: ilYA(s.avis.il_y_a), nouveauLoyer: s.avis.nouveauLoyer, reponseAvis: s.avis.reponse || null } : {}),
          },
        }));
      }
      baux[cleLogement] = liste.at(-1);

      // Loyers des douze derniers mois et leurs paiements
      for (const bail of liste) {
        for (const periode of periodes) {
          const montant = loyerDuMois(bail, periode);
          if (montant <= 0) continue;
          const [a, m] = periode.split("-").map(Number);
          const echeance = new Date(Date.UTC(a, m - 1, bail.jourPaiement, 12));
          charges.push({ bailId: bail.id, date: echeance, periode, type: "LOYER", description: `Loyer — ${periodeLisible(periode)}${montant !== bail.loyer ? " (au prorata)" : ""}`, montant, creePar: AUTEUR_IMMO_DEMO });
          const rang = periodes.length - 1 - periodes.indexOf(periode); // 0 = mois courant
          if (s.periodesImpayees?.includes(rang)) continue;
          const [min, max] = s.delai || [0, 3];
          const quand = new Date(echeance.getTime() + Math.round(min + alea() * (max - min)) * JOUR);
          if (quand > new Date()) continue;
          const paye = rang === 0 && s.partiel ? arrondi(montant * s.partiel) : montant;
          const numero = 100 + Math.floor(alea() * 800);
          paiements.push({
            bailId: bail.id, date: quand, montant: paye, mode: s.mode,
            reference: s.mode === "CHEQUE" ? `Chèque n° ${numero}` : s.mode === "VIREMENT" ? `Interac ${String(numero).padStart(4, "0")}` : null,
            note: paye !== montant ? "Paiement partiel — le reste promis pour le 25." : null, creePar: AUTEUR_IMMO_DEMO,
          });
        }
      }
    }
    // Frais de chèque sans provision (Kevin Bouchard)
    charges.push({ bailId: baux["erables/1"].id, date: ilYA(40), type: "FRAIS", description: "Frais de chèque sans provision", montant: 25, creePar: AUTEUR_IMMO_DEMO });
    await prisma.chargeImmo.createMany({ data: charges });
    await prisma.paiementImmo.createMany({ data: paiements });

    // Dépenses de l'année
    const depenses = [];
    for (const [imm, categorie, description, montant, payeA, jour] of DEPENSES_MENSUELLES) {
      for (let rang = 11; rang >= 0; rang--) {
        const p = periodeIlYA(rang);
        const [a, m] = p.split("-").map(Number);
        const d = new Date(Date.UTC(a, m - 1, jour, 12));
        if (d > new Date()) continue;
        // Chauffage : surtout l'hiver
        const hiver = [11, 12, 1, 2, 3].includes(m) ? 1.6 : [4, 10].includes(m) ? 1 : 0.35;
        const facteur = categorie === "CHAUFFAGE" ? hiver : 1;
        depenses.push({ immeubleId: immeubles[imm].id, date: d, categorie, description, montant: arrondi(montant * facteur), payeA, creePar: AUTEUR_IMMO_DEMO });
      }
    }
    for (const [imm, categorie, description, montant, payeA, jours] of DEPENSES_PONCTUELLES) {
      depenses.push({ immeubleId: immeubles[imm].id, date: ilYA(jours), categorie, description, montant, payeA, creePar: AUTEUR_IMMO_DEMO });
    }
    await prisma.depenseImmo.createMany({ data: depenses });

    // Réparations
    for (const [lieu, titre, categorie, priorite, statut, ilYaJours, x] of REPARATIONS) {
      const [imm, num] = lieu.split("/");
      const logement = num ? logements[lieu] : null;
      const r = await creerReparation({
        titre, categorie, priorite, statut, description: x.description || null, immeubleId: immeubles[imm].id, logementId: logement?.id || null,
        locataireId: x.locataire ? locataires[x.locataire].id : null, signalePar: x.locataire ? null : "Propriétaire",
        entrepreneur: x.entrepreneur || null, telephoneEntrepreneur: x.telephoneEntrepreneur || null,
        datePrevue: x.datePrevue != null ? ilYA(x.datePrevue) : null, dateFin: x.dateFin != null ? ilYA(x.dateFin) : null,
        coutEstime: x.coutEstime ?? null, coutReel: x.coutReel ?? null, numeroFacture: x.numeroFacture || null, notes: x.notes || null,
        creePar: x.portail ? locataires[x.locataire].nom : AUTEUR_IMMO_DEMO, source: x.portail ? "PORTAIL" : "INTERNE", reponse: x.reponse || null,
      });
      await prisma.reparationImmo.update({ where: { id: r.id }, data: { creeLe: ilYA(ilYaJours) } });
    }

    // Documents
    const b4 = baux["erables/4"];
    const documents = [
      { titre: "Réponse à l'avis — Nadia Benali quitte", visibleLocataire: true, categorie: "AVIS", date: ilYA(22), immeubleId: immeubles.erables.id, logementId: logements["erables/4"].id, bailId: b4.id, locataireId: locataires.benali.id, lignes: [`Je vous avise que je quitterai le logement à la fin de mon bail, le ${date(b4.dateFin)}.`, "— Nadia Benali"] },
      { titre: "Police d'assurance — Triplex Champlain", categorie: "ASSURANCE", date: ilYA(340), expireLe: ilYA(-25), immeubleId: immeubles.champlain.id, lignes: ["Assureur : Assurances Richelieu (fictif). Police n° PO-55120.", "Valeur à neuf assurée : 690 000 $. Responsabilité civile : 2 000 000 $.", "Échéance : à renouveler dans le mois — demander deux soumissions."] },
      { titre: "Police d'assurance — Édifice Richelieu", categorie: "ASSURANCE", date: ilYA(60), expireLe: ilYA(-305), immeubleId: immeubles.richelieu.id, lignes: ["Assureur : Assurances Richelieu (fictif). Police n° CM-88340.", "Immeuble mixte : couverture des locaux commerciaux et perte de revenus locatifs (12 mois)."] },
      { titre: "Compte de taxes municipales — Sixplex des Érables", categorie: "TAXES", date: ilYA(260), immeubleId: immeubles.erables.id, lignes: ["Évaluation municipale : 912 000 $.", "Total de l'année : 9 760 $, en deux versements."] },
      { titre: "Certificat de localisation — Édifice Richelieu", categorie: "ACTE", date: ilYA(905), immeubleId: immeubles.richelieu.id, lignes: ["Lot 4 041 220, cadastre du Québec.", "Aucun empiétement constaté."] },
      { titre: "Contrat de déneigement 2026-2027 — Érables", categorie: "CONTRATS", date: ilYA(35), expireLe: ilYA(-150), immeubleId: immeubles.erables.id, lignes: ["Déneigement Chambly : stationnement et entrées, 2 300 $ pour la saison, en deux versements."] },
      { titre: "Règlement de l'immeuble — Sixplex des Érables", visibleLocataire: true, categorie: "AUTRE", date: ilYA(700), immeubleId: immeubles.erables.id, lignes: ["Bruit : aucun bruit excessif entre 22 h et 7 h.", "Laveuse et sécheuse communes : de 8 h à 21 h ; nettoyer le filtre après chaque usage.", "Stationnement : une place par logement, déneigement par le propriétaire.", "Animaux : selon le bail ; tenus en laisse dans les aires communes.", "Remis à chaque locataire avec son bail."] },
      { titre: "Bail commercial — Café Le Vieux-Moulin", visibleLocataire: true, categorie: "BAIL", date: ilYA(1110), immeubleId: immeubles.richelieu.id, logementId: logements["richelieu/Local A"].id, bailId: baux["richelieu/Local A"].id, lignes: ["Bail commercial net de 5 ans.", `Loyer de base : ${dollars(3200)} par mois, indexé de 2 % par année.`, "Taxes foncières refacturées au prorata de la superficie (1 400 pi² sur 4 600 pi²)."] },
    ];
    for (const { lignes, ...d } of documents) {
      const donnees = await pdf(d.titre, lignes);
      await prisma.documentImmo.create({ data: { ...d, nom: nomFichier(d.titre), typeMime: "application/pdf", taille: donnees.length, donnees, creePar: AUTEUR_IMMO_DEMO }, select: { id: true } });
    }

    // Relevés 31 de l'an dernier : produits et remis à la fin février
    const anneePassee = new Date().getUTCFullYear() - 1;
    const bauxAnPasse = await prisma.bailImmo.findMany({
      where: { logementId: { in: Object.values(logements).filter((l) => l.type === "LOGEMENT").map((l) => l.id) }, dateDebut: { lte: new Date(Date.UTC(anneePassee, 11, 31, 23)) }, OR: [{ dateFin: null }, { dateFin: { gte: new Date(Date.UTC(anneePassee, 11, 31)) } }] },
      select: { id: true },
    });
    await prisma.releve31Immo.createMany({
      data: bauxAnPasse.map((b) => ({ annee: anneePassee, bailId: b.id, produitLe: new Date(Date.UTC(anneePassee + 1, 1, 20, 12)), remisLe: new Date(Date.UTC(anneePassee + 1, 1, 22, 12)), creePar: AUTEUR_IMMO_DEMO })),
    });

    // Portail : trois locataires y ont accès (Amélie Côté peut y répondre à son avis de modification)
    for (const cle of ["cote", "bouchard", "tremblay"]) {
      await prisma.locataireImmo.update({ where: { id: locataires[cle].id }, data: { jetonPortail: nouveauJeton(), dernierAccesPortail: ilYA(cle === "cote" ? 2 : 12), avisCourriel: false } });
    }

    // Documents générés par l'appli, comme le ferait le propriétaire
    const generes = [
      ["erables/2", "AVIS_MODIFICATION", { nouveauLoyer: "1040", dateAvis: ilYA(9).toISOString() }],
      ["erables/5", "AVIS_MODIFICATION", { nouveauLoyer: "1065", dateAvis: ilYA(190).toISOString(), marquerEnvoye: false }],
      ["erables/1", "RAPPEL_RETARD", { dateAvis: ilYA(6).toISOString(), delaiJours: "10" }],
      ["erables/4", "AVIS_ACCES", { motif: "VISITE_LOCATAIRE", dateAcces: ilYA(-3).toISOString(), heure: "entre 18 h et 19 h 30", details: "Deux visites de locataires éventuels : le logement se libère à la fin du bail.", dateAvis: ilYA(1).toISOString() }],
      ["champlain/316", "AVIS_ACCES", { motif: "TRAVAUX", dateAcces: ilYA(-2).toISOString(), heure: "vers 9 h", details: "Réparation de la fenêtre de la chambre (mécanisme à manivelle).", dateAvis: ilYA(0).toISOString() }],
      ["richelieu/202", "ETAT_LIEUX", { moment: "SORTIE", dateVisite: ilYA(58).toISOString(), dateAvis: ilYA(58).toISOString() }],
      ["champlain/312", "FICHE_BAIL", { dateAvis: ilYA(200).toISOString() }],
      ["erables/4", "FICHE_BAIL", { dateAvis: ilYA(330).toISOString() }],
    ];
    for (const [cle, type, valeurs] of generes) {
      const r = await genererDocumentBail(baux[cle].id, type, valeurs, AUTEUR_IMMO_DEMO);
      if (r.erreur) throw new Error(`${type} (${cle}) : ${r.erreur}`);
    }

    const reparations = await prisma.reparationImmo.count({ where: { immeubleId: { in: ids.immeubles } } });
    return { immeubles: ids.immeubles.length, logements: Object.keys(logements).length, locataires: ids.locataires.length, reparations };
  } catch (e) {
    console.error("Immobilier de démonstration : échec du chargement", e);
    await noterIds(ids);
    await retirerImmoDemo().catch((e2) => console.error("Immobilier de démonstration : échec du nettoyage", e2));
    return { erreur: `Le chargement a échoué : ${String(e.message || e).split("\n")[0]}` };
  }
}

// ---------- Retrait ----------

// Retire les immeubles de démonstration et tout ce qui s'y rattache
// (logements, baux, loyers, paiements, dépenses, réparations, documents —
// y compris ceux ajoutés pendant les essais), les locataires de
// démonstration, et les locataires ajoutés pendant les essais qui
// n'avaient de bail que dans ces immeubles.
// → { immeubles, logements, locataires, reparations } ou { erreur }
export async function retirerImmoDemo() {
  const ids = await lireIds();
  if (!ids) return { erreur: "L'immobilier de démonstration n'est pas chargé." };

  const resultat = await prisma.$transaction(async (tx) => {
    const ajoutes = await tx.locataireImmo.findMany({ where: { baux: { some: { logement: { immeubleId: { in: ids.immeubles } } } } }, select: { id: true } });
    const [logements, reparations] = await Promise.all([
      tx.logementImmo.count({ where: { immeubleId: { in: ids.immeubles } } }),
      tx.reparationImmo.count({ where: { immeubleId: { in: ids.immeubles } } }),
    ]);
    await tx.documentImmo.deleteMany({ where: { OR: [{ immeubleId: { in: ids.immeubles } }, { locataireId: { in: ids.locataires } }] } });
    const immeubles = await tx.immeubleImmo.deleteMany({ where: { id: { in: ids.immeubles } } });
    const candidats = [...new Set([...ids.locataires, ...ajoutes.map((l) => l.id)])];
    // Un locataire de démonstration réinscrit à un vrai bail pendant les essais reste
    const locataires = await tx.locataireImmo.deleteMany({ where: { id: { in: candidats }, baux: { none: {} } } });
    return { immeubles: immeubles.count, logements, locataires: locataires.count, reparations };
  }, { timeout: 60000 });

  await prisma.parametre.deleteMany({ where: { cle: CLE } });
  return resultat;
}
