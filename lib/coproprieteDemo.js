// Copropriété de démonstration (Administrateur → Copropriété de
// démonstration) : un syndicat complet pour présenter le module Copropriété —
// un immeuble de 13 fractions dont les quotes-parts totalisent 100 %,
// copropriétaires (indivision, propriétaire de deux unités, unité revendue),
// locataires, stationnements et rangements, budgets de deux exercices, six
// mois de cotisations et de paiements (une unité en retard, une cotisation
// spéciale impayée), demandes à chaque étape, bons de travail avec leur
// suivi, entretien préventif (en retard, à venir) et documents.
//
// Chargée seulement dans une copropriété vide. Ce qui est créé est noté dans
// le paramètre « copropriete_demo » : « Retirer » l'efface avec tout ce qui
// s'y rattache — y compris les demandes et bons de travail ajoutés ensuite à
// cet immeuble pendant les essais — sans toucher à un vrai immeuble ajouté
// à côté.

import PDFDocument from "pdfkit";
import { prisma } from "./prisma";
import { prochainNumeroFournisseur } from "./numerotation";
import { creerDemande, creerTravail, genererCotisations, nouveauJeton } from "./copropriete";
import { repartitionBudget } from "./coproprieteCalculs";

export const AUTEUR_COPRO_DEMO = "Démonstration";
const CLE = "copropriete_demo";

// ---------- Données ----------

// [numéro, type, étage, superficie (pi²), quote-part (%)] — total : 100 %
const UNITES = [
  ["101", "LOGEMENT", "1", 820, 6.5], ["102", "LOGEMENT", "1", 820, 6.5], ["103", "LOGEMENT", "1", 835, 6.5], ["104", "LOGEMENT", "1", 835, 6.5],
  ["201", "LOGEMENT", "2", 960, 7.5], ["202", "LOGEMENT", "2", 960, 7.5], ["203", "LOGEMENT", "2", 975, 7.5], ["204", "LOGEMENT", "2", 975, 7.5],
  ["301", "LOGEMENT", "3", 1090, 8.5], ["302", "LOGEMENT", "3", 1090, 8.5], ["303", "LOGEMENT", "3", 1110, 8.5], ["304", "LOGEMENT", "3", 1110, 8.5],
  ["C-1", "COMMERCIAL", "RC", 1400, 10],
];

// portail : reçoit un lien de portail. Les avis par courriel sont coupés :
// les adresses sont fictives.
const COPROPRIETAIRES = [
  { nom: "Louise Bergeron", courriel: "louise.bergeron@example.com", telephone: "450-555-0301", portail: true },
  { nom: "Michel Fortin", courriel: "michel.fortin@example.com", telephone: "450-555-0302", portail: true },
  { nom: "Isabelle Fortin", courriel: "isabelle.fortin@example.com", telephone: "450-555-0303" },
  { nom: "Karim Haddad", courriel: "karim.haddad@example.com", telephone: "514-555-0304", portail: true },
  { nom: "Gestion Immobilière Morin inc.", courriel: "info@gestionmorin.example", telephone: "450-555-0305", adressePostale: "1200 boul. du Séminaire Nord, Saint-Jean-sur-Richelieu (Québec) J3A 1B5", notes: "Propriétaire non occupant — deux unités louées." },
  { nom: "Denise Lachance", courriel: "denise.lachance@example.com", telephone: "450-555-0306" },
  { nom: "François Pelletier", courriel: "francois.pelletier@example.com", telephone: "450-555-0307" },
  { nom: "Nancy Girard", courriel: "nancy.girard@example.com", telephone: "438-555-0308", notes: "Deux mois de charges en retard — entente de paiement à proposer." },
  { nom: "Sébastien Caron", courriel: "sebastien.caron@example.com", telephone: "450-555-0309" },
  { nom: "Thi Mai Nguyen", courriel: "mai.nguyen@example.com", telephone: "514-555-0310" },
  { nom: "Robert Dufour", courriel: "robert.dufour@example.com", telephone: "450-555-0311" },
  { nom: "Chantal Beaulieu", courriel: "chantal.beaulieu@example.com", telephone: "450-555-0312", portail: true },
  { nom: "Pharmacie du Canal inc.", courriel: "admin@pharmacieducanal.example", telephone: "450-555-0313" },
  { nom: "André Vachon", telephone: "450-555-0314", notes: "Ancien propriétaire du 303." },
];

// [unité, copropriétaire (rang), depuis (jours), part (%), jusqu'à (jours)]
const PROPRIETES = [
  ["101", 0, 3200], ["102", 1, 2100, 50], ["102", 2, 2100, 50], ["103", 3, 900], ["104", 4, 2600],
  ["201", 4, 1800], ["202", 5, 3900], ["203", 7, 1300], ["204", 6, 2400],
  ["301", 8, 700], ["302", 9, 1600], ["303", 13, 3900, 100, 420], ["303", 10, 420], ["304", 11, 2900],
  ["C-1", 12, 3600],
];

const OCCUPANTS = [
  ["104", "LOCATAIRE", "Jonathan Poirier", "450-555-0321", 380],
  ["201", "LOCATAIRE", "Émilie Tessier et Marc Dion", "450-555-0322", 760],
  ["101", "PROPRIETAIRE", "Louise Bergeron", "450-555-0301", 3200],
];

const FOURNISSEURS = [
  { nom: "Plomberie Richelieu", telephone: "450-555-0410", courriel: "service@plomberierichelieu.example", ville: "Saint-Jean-sur-Richelieu", province: "QC" },
  { nom: "Toitures Haut-Richelieu", telephone: "450-555-0420", courriel: "soumissions@toitureshr.example", ville: "Iberville", province: "QC" },
  { nom: "Ascenseurs Montérégie", telephone: "450-555-0430", courriel: "entretien@ascenseursmonteregie.example", ville: "Longueuil", province: "QC" },
  { nom: "Protection incendie Rive-Sud", telephone: "450-555-0440", courriel: "inspection@incendierivesud.example", ville: "Brossard", province: "QC" },
  { nom: "Portes de garage Lemieux", telephone: "450-555-0450", ville: "Chambly", province: "QC" },
];

// [titre, type, catégorie, fréquence (mois), prochaine date (dans n jours ; négatif = en retard), fournisseur (rang), coût estimé, obligatoire]
const ENTRETIENS = [
  ["Inspection des extincteurs portatifs", "INSPECTION", "INCENDIE", 12, -12, 3, 280, true],
  ["Nettoyage des gouttières et drains de toit", "ENTRETIEN", "TOITURE", 6, -3, 1, 420, false],
  ["Changement des filtres de ventilation", "ENTRETIEN", "CVAC", 3, 9, null, 160, false],
  ["Inspection du système d'alarme incendie", "INSPECTION", "INCENDIE", 12, 18, 3, 650, true],
  ["Inspection de l'ascenseur", "INSPECTION", "ASCENSEUR", 12, 75, 2, 890, true],
  ["Inspection de la toiture", "INSPECTION", "TOITURE", 12, 150, 1, 350, false],
  ["Vérification des portes de garage", "ENTRETIEN", "PORTES", 6, 110, 4, 240, false],
  ["Mise à jour de l'étude du fonds de prévoyance", "INSPECTION", "AUTRE", 60, 400, null, 3800, true],
];

// ---------- Outils ----------

// Il y a n jours (n négatif : dans n jours), à midi UTC — comme toutes les
// dates de la copropriété
function ilYA(n) {
  const d = new Date(Date.now() - n * 86400000);
  return new Date(`${d.toISOString().slice(0, 10)}T12:00:00Z`);
}
// Période « 2026-11 » d'il y a n mois
function periodeIlYA(n) {
  const d = new Date();
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1, 12));
  return r.toISOString().slice(0, 7);
}
const arrondi = (n) => Math.round(n * 100) / 100;

// Petit PDF d'une page, pour que les documents s'ouvrent vraiment
function pdf(titre, lignes) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 64 });
    const morceaux = [];
    doc.on("data", (m) => morceaux.push(m));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);
    doc.fontSize(10).fillColor("#888888").text("Syndicat de la copropriété Les Jardins du Richelieu — document de démonstration");
    doc.moveDown(1.5).fontSize(20).fillColor("#000000").text(titre);
    doc.moveDown(1).fontSize(11);
    for (const ligne of lignes) doc.text(ligne, { paragraphGap: 8 });
    doc.end();
  });
}

// Les dossiers notés au chargement — null si rien n'est chargé, ou si les
// données ont été effacées depuis (Réinitialisation garde les paramètres)
async function lireIds() {
  const p = await prisma.parametre.findUnique({ where: { cle: CLE } });
  if (!p) return null;
  let ids;
  try { ids = JSON.parse(p.valeur); } catch { return null; }
  const reste = await Promise.all([
    prisma.batimentCopro.count({ where: { id: { in: ids.batiments } } }), prisma.uniteCopro.count({ where: { id: { in: ids.unites } } }),
    prisma.coproprietaireCopro.count({ where: { id: { in: ids.coproprietaires } } }), prisma.budgetCopro.count({ where: { id: { in: ids.budgets } } }),
    prisma.fournisseur.count({ where: { id: { in: ids.fournisseurs } } }),
  ]);
  return reste.some((n) => n > 0) ? ids : null;
}
const noterIds = (ids) => prisma.parametre.upsert({ where: { cle: CLE }, update: { valeur: JSON.stringify(ids) }, create: { cle: CLE, valeur: JSON.stringify(ids) } });

// Ce que la copropriété contient déjà (tout à 0 : la démonstration peut se charger)
async function contenu() {
  const [batiments, unites, coproprietaires, budgets] = await Promise.all([
    prisma.batimentCopro.count(), prisma.uniteCopro.count(), prisma.coproprietaireCopro.count(), prisma.budgetCopro.count(),
  ]);
  return { batiments, unites, coproprietaires, budgets };
}

// → { charge, unites (de démonstration), vide }
export async function etatCoproDemo() {
  const [ids, c] = await Promise.all([lireIds(), contenu()]);
  return {
    charge: !!ids,
    unites: ids ? await prisma.uniteCopro.count({ where: { id: { in: ids.unites } } }) : 0,
    vide: Object.values(c).every((n) => n === 0),
  };
}

// ---------- Chargement ----------

// → { unites, coproprietaires, demandes, travaux } ou { erreur }
export async function chargerCoproDemo() {
  if (await lireIds()) return { erreur: "La copropriété de démonstration est déjà chargée." };
  if (Object.values(await contenu()).some((n) => n > 0)) return { erreur: "La copropriété contient déjà des immeubles, des unités, des copropriétaires ou un budget : la copropriété de démonstration ne se charge que dans une copropriété vide." };

  const ids = { batiments: [], unites: [], coproprietaires: [], budgets: [], entretiens: [], espaces: [], fournisseurs: [], documents: [] };
  try {
    await noterIds(ids);
    const batiment = await prisma.batimentCopro.create({
      data: { nom: "Les Jardins du Richelieu", adresse: "145 rue du Quai, Saint-Jean-sur-Richelieu (Québec) J3B 6X2", anneeConstruction: 2014, nbEtages: 4, notes: "12 logements sur trois étages, un local commercial au rez-de-chaussée, garage souterrain de 14 places." },
    });
    ids.batiments.push(batiment.id);

    const unites = {};
    for (const [numero, type, etage, superficie, quotePart] of UNITES) {
      unites[numero] = await prisma.uniteCopro.create({ data: { numero, type, etage, superficie, quotePart, batimentId: batiment.id, numeroLot: `5 ${String(412300 + ids.unites.length).replace(/(\d{3})$/, " $1")}` } });
      ids.unites.push(unites[numero].id);
    }
    const coproprietaires = [];
    for (const { portail, ...c } of COPROPRIETAIRES) {
      coproprietaires.push(await prisma.coproprietaireCopro.create({ data: { ...c, avisCourriel: false, jetonPortail: portail ? nouveauJeton() : null } }));
      ids.coproprietaires.push(coproprietaires.at(-1).id);
    }
    await noterIds(ids);
    await prisma.proprieteCopro.createMany({
      data: PROPRIETES.map(([unite, c, depuis, part = 100, jusqua]) => ({ uniteId: unites[unite].id, coproprietaireId: coproprietaires[c].id, dateDebut: ilYA(depuis), dateFin: jusqua ? ilYA(jusqua) : null, partDetenue: part })),
    });
    await prisma.occupantCopro.createMany({
      data: OCCUPANTS.map(([unite, type, nom, telephone, depuis]) => ({ uniteId: unites[unite].id, type, nom, telephone, dateDebut: ilYA(depuis) })),
    });

    // Garage : une place par logement (usage restreint), deux places louées
    // par le syndicat (une libre), quatre rangements
    const logements = UNITES.filter((u) => u[1] === "LOGEMENT").map((u) => u[0]);
    const espaces = [
      ...logements.map((numero, i) => ({ type: "STATIONNEMENT", numero: `P-${String(i + 1).padStart(2, "0")}`, emplacement: "Garage souterrain", uniteId: unites[numero].id })),
      { type: "STATIONNEMENT", numero: "P-13", emplacement: "Garage souterrain", uniteId: unites["301"].id, mode: "LOCATION", fraisMensuel: 45 },
      { type: "STATIONNEMENT", numero: "P-14", emplacement: "Garage souterrain", mode: "LOCATION", fraisMensuel: 45, notes: "Libre — à louer." },
      ...["101", "202", "304", "C-1"].map((numero, i) => ({ type: "RANGEMENT", numero: `R-${String(i + 1).padStart(2, "0")}`, emplacement: "Sous-sol", uniteId: unites[numero].id })),
      { type: "VELO", numero: "V-01", emplacement: "Entrée du garage", notes: "Support commun, 10 vélos." },
    ];
    for (const e of espaces) ids.espaces.push((await prisma.espaceCopro.create({ data: { ...e, batimentId: batiment.id } })).id);

    // Budgets : l'exercice en cours et le précédent (les six derniers mois
    // de cotisations peuvent chevaucher les deux)
    const annee = new Date().getUTCFullYear();
    for (const b of [
      { annee: annee - 1, chargesCourantes: 58800, fondsPrevoyance: 8400, fondsAutoAssurance: 2400, adopteLe: new Date(Date.UTC(annee - 2, 10, 20, 12)), notes: "Adopté à l'assemblée annuelle." },
      { annee, chargesCourantes: 62400, fondsPrevoyance: 9600, fondsAutoAssurance: 2400, adopteLe: new Date(Date.UTC(annee - 1, 10, 19, 12)), notes: "Adopté à l'assemblée annuelle. Hausse de 6 % : assurance et déneigement." },
    ]) ids.budgets.push((await prisma.budgetCopro.create({ data: b })).id);
    await noterIds(ids);

    // Cotisations des six derniers mois (ce mois-ci compris), puis une
    // cotisation spéciale il y a trois mois, répartie selon les quotes-parts
    const periodes = [5, 4, 3, 2, 1, 0].map(periodeIlYA);
    for (const periode of periodes) {
      const r = await genererCotisations(periode, AUTEUR_COPRO_DEMO);
      if (r.erreur) throw new Error(r.erreur);
    }
    const listeUnites = Object.values(unites);
    const { lignes: partsSpeciale } = repartitionBudget({ chargesCourantes: 18000 }, listeUnites);
    await prisma.chargeCopro.createMany({
      data: partsSpeciale.map((l) => ({ uniteId: l.uniteId, date: new Date(`${periodes[2]}-15T12:00:00Z`), periode: periodes[2], type: "SPECIALE", description: "Cotisation spéciale — réfection de la toiture (1er versement)", montant: l.annuel, creePar: AUTEUR_COPRO_DEMO })),
    });

    // Paiements : chaque unité règle chaque mois ce qui lui est facturé, sauf
    // le 203 (rien depuis deux mois) et le 302 (cotisation spéciale impayée) ;
    // le local commercial paie par chèque
    const charges = await prisma.chargeCopro.findMany({ where: { uniteId: { in: ids.unites } } });
    const aujourdhui = ilYA(0);
    const paiements = [];
    listeUnites.forEach((unite, i) => {
      periodes.forEach((periode, rang) => {
        if (unite.numero === "203" && rang >= 4) return;
        const duMois = charges.filter((c) => c.uniteId === unite.id && c.periode === periode);
        const cheque = unite.numero === "C-1";
        // Les charges du mois au début du mois ; la cotisation spéciale à part, après son avis
        for (const [speciale, jour] of [[false, `0${1 + (i % 3)}`], [true, `2${i % 3}`]]) {
          if (speciale && unite.numero === "302") continue;
          const montant = arrondi(duMois.filter((c) => (c.type === "SPECIALE") === speciale).reduce((s, c) => s + c.montant, 0));
          if (montant <= 0) continue;
          const date = new Date(`${periode}-${jour}T12:00:00Z`);
          paiements.push({
            uniteId: unite.id, date: date > aujourdhui ? aujourdhui : date, montant, creePar: AUTEUR_COPRO_DEMO,
            mode: cheque || speciale ? "CHEQUE" : i % 4 === 3 ? "VIREMENT" : "PREAUTORISE", reference: cheque || speciale ? String(2210 + rang * 7 + i + (speciale ? 100 : 0)) : null,
          });
        }
      });
    });
    await prisma.paiementCopro.createMany({ data: paiements });

    const fournisseurs = [];
    for (const f of FOURNISSEURS) {
      fournisseurs.push(await prisma.fournisseur.create({ data: { ...f, numero: await prochainNumeroFournisseur() } }));
      ids.fournisseurs.push(fournisseurs.at(-1).id);
    }
    const entretiens = [];
    for (const [titre, type, categorie, frequenceMois, dans, fournisseur, coutEstime, obligatoire] of ENTRETIENS) {
      entretiens.push(await prisma.entretienCopro.create({
        data: {
          titre, type, categorie, frequenceMois, coutEstime, obligatoire, batimentId: batiment.id,
          prochaineDate: ilYA(-dans), derniereDate: ilYA(-dans + Math.round(frequenceMois * 30.4)), fournisseurId: fournisseur === null ? null : fournisseurs[fournisseur].id,
        },
      }));
      ids.entretiens.push(entretiens.at(-1).id);
    }
    await noterIds(ids);

    // Demandes à chaque étape, avec leurs bons de travail et leur suivi
    const demande = ({ unite, coproprietaire, jours, ...d }) => creerDemande({
      ...d, batimentId: batiment.id, uniteId: unite ? unites[unite].id : null, coproprietaireId: coproprietaire === undefined ? null : coproprietaires[coproprietaire].id,
      creePar: AUTEUR_COPRO_DEMO, creeLe: ilYA(jours),
    });
    const travail = ({ unite, fournisseur, jours, suivis = [], ...t }) => creerTravail({
      ...t, batimentId: batiment.id, uniteId: unite ? unites[unite].id : null, fournisseurId: fournisseur === undefined ? null : fournisseurs[fournisseur].id,
      creePar: AUTEUR_COPRO_DEMO, creeLe: ilYA(jours),
      suivis: { create: suivis.map(([j, statut, texte, pub = true]) => ({ date: ilYA(j), statut, texte, public: pub, auteur: AUTEUR_COPRO_DEMO })) },
    });

    await demande({ jours: 1, titre: "Robinet de la cuisine qui fuit", description: "Le robinet goutte sans arrêt depuis hier, même bien fermé.", categorie: "PLOMBERIE", unite: "102", coproprietaire: 1, source: "PORTAIL" });
    await demande({ jours: 2, type: "SIGNALEMENT", titre: "Lumière brûlée dans le corridor du 3e", categorie: "ELECTRICITE", priorite: "BASSE", emplacement: "Corridor du 3e étage", signalePar: "Concierge" });
    const dGarage = await demande({ jours: 6, type: "SIGNALEMENT", titre: "Porte de garage qui se referme mal", description: "La porte remonte toute seule une fois sur trois.", categorie: "PORTES", priorite: "HAUTE", emplacement: "Garage souterrain", coproprietaire: 3, source: "PORTAIL", statut: "ACCEPTEE", reponse: "Un technicien passe cette semaine." });
    await travail({ jours: 5, titre: "Réglage de la porte de garage", categorie: "PORTES", priorite: "HAUTE", statut: "PLANIFIE", demandeId: dGarage.id, emplacement: "Garage souterrain", fournisseur: 4, datePrevue: ilYA(-4), coutEstime: 450, suivis: [[5, "PLANIFIE", "Rendez-vous pris avec le fournisseur."]] });
    const dToit = await demande({ jours: 9, titre: "Infiltration d'eau au plafond de la chambre", description: "Tache qui grandit au plafond après chaque pluie.", categorie: "TOITURE", priorite: "URGENTE", unite: "304", coproprietaire: 11, source: "PORTAIL", statut: "EN_COURS", reponse: "Le couvreur a trouvé la source ; la réparation est en cours." });
    await travail({
      jours: 8, titre: "Réparation de la membrane au-dessus du 304", description: "Solin décollé près de l'évent de plomberie.", categorie: "TOITURE", priorite: "URGENTE", statut: "EN_COURS", demandeId: dToit.id, unite: "304", emplacement: "Toit, coin nord-est",
      fournisseur: 1, datePrevue: ilYA(3), coutEstime: 2400,
      suivis: [[8, "PLANIFIE", "Inspection d'urgence demandée au couvreur."], [6, null, "Bâche temporaire posée ; source trouvée au solin de l'évent."], [3, "EN_COURS", "Réparation commencée. Le plafond du 304 sera refait une fois le toit étanche."], [2, null, "Soumission pour le plafond à comparer avec un deuxième entrepreneur.", false]],
    });
    const dEau = await demande({ jours: 34, type: "SIGNALEMENT", titre: "Fuite au chauffe-eau commun", description: "Eau au sol dans la salle mécanique.", categorie: "PLOMBERIE", priorite: "URGENTE", emplacement: "Salle mécanique", signalePar: "Concierge", statut: "TERMINEE", reponse: "Chauffe-eau remplacé." });
    await travail({
      jours: 34, titre: "Remplacement du chauffe-eau commun", categorie: "PLOMBERIE", priorite: "URGENTE", statut: "TERMINE", demandeId: dEau.id, emplacement: "Salle mécanique",
      fournisseur: 0, datePrevue: ilYA(32), dateFin: ilYA(31), coutEstime: 1900, coutReel: 2185, numeroFacture: "PR-20418", garantieFin: ilYA(31 - 365 * 6),
      suivis: [[34, "PLANIFIE", "Plombier appelé d'urgence ; eau coupée à la salle mécanique."], [32, "EN_COURS", "Réservoir percé : remplacement nécessaire."], [31, "TERMINE", "Nouveau chauffe-eau de 80 gallons en service. Garantie de 6 ans sur le réservoir."]],
    });
    await demande({ jours: 20, titre: "Remplacement du comptoir de cuisine", description: "Le comptoir est abîmé près de l'évier.", categorie: "AUTRE", priorite: "BASSE", unite: "201", coproprietaire: 4, statut: "REFUSEE", reponse: "Le comptoir fait partie de la partie privative : son remplacement revient au propriétaire de l'unité." });
    // Bons sans demande : une inspection née de l'entretien préventif, et un contrat à planifier
    await travail({
      jours: 290, titre: "Inspection annuelle de l'ascenseur", categorie: "ASCENSEUR", statut: "TERMINE", entretienId: entretiens[4].id, emplacement: "Ascenseur", fournisseur: 2,
      datePrevue: ilYA(290), dateFin: ilYA(290), coutEstime: 890, coutReel: 890, numeroFacture: "AM-7731", suivis: [[290, "TERMINE", "Inspection conforme. Certificat affiché dans la cabine."]],
    });
    await travail({ jours: 4, titre: "Contrat de déneigement — saison à venir", description: "Trois soumissions à obtenir avant l'assemblée.", categorie: "TERRAIN", statut: "A_PLANIFIER", emplacement: "Stationnement extérieur et entrées", coutEstime: 5200 });

    // Documents : de vrais PDF d'une page
    const documents = [
      { titre: "Procès-verbal — assemblée annuelle", categorie: "PV_ASSEMBLEE", date: new Date(Date.UTC(annee - 1, 10, 19, 12)), lignes: ["Quorum constaté : 11 fractions représentées sur 13 (86,5 % des voix).", "1. Adoption du budget de l'exercice : adopté à la majorité.", "2. Réfection de la toiture : cotisation spéciale de 18 000 $ en deux versements, adoptée.", "3. Élection du conseil d'administration : trois administrateurs réélus."] },
      { titre: "Règlement de l'immeuble", categorie: "REGLEMENTS", date: ilYA(900), lignes: ["Animaux : permis, tenus en laisse dans les parties communes.", "Bruit : aucun travail bruyant avant 8 h ni après 20 h.", "Stationnement : une place par logement ; les places P-13 et P-14 sont louées par le syndicat.", "Balcons : aucun entreposage ; barbecues au propane seulement."] },
      { titre: `Budget de l'exercice ${annee}`, categorie: "BUDGETS", date: new Date(Date.UTC(annee - 1, 10, 19, 12)), lignes: ["Charges courantes : 62 400 $", "Fonds de prévoyance : 9 600 $", "Fonds d'autoassurance : 2 400 $", "Total à répartir selon les quotes-parts : 74 400 $, soit 6 200 $ par mois."] },
      { titre: "Certificat d'assurance de l'immeuble", categorie: "ASSURANCES", date: ilYA(200), lignes: ["Assureur : La Mutuelle du Haut-Richelieu (fictif).", "Valeur de reconstruction assurée : 4 850 000 $.", "Franchise dégât d'eau : 25 000 $ — couverte par le fonds d'autoassurance."] },
      { titre: "Soumissions de déneigement (à l'étude)", categorie: "CONTRATS", visibilite: "ADMIN", date: ilYA(4), lignes: ["Document de travail du conseil d'administration — non partagé aux copropriétaires.", "Soumission A : 5 200 $ pour la saison.", "Soumission B : en attente."] },
      { titre: "Avis de retard — unité 203", categorie: "UNITE", visibilite: "UNITE", uniteId: unites["203"].id, date: ilYA(5), lignes: ["Deux mois de charges communes sont impayés pour l'unité 203.", "Merci de régulariser la situation ou de communiquer avec le syndicat pour convenir d'une entente."] },
    ];
    for (const { lignes, ...d } of documents) {
      const donnees = await pdf(d.titre, lignes);
      const doc = await prisma.documentCopro.create({
        data: { ...d, batimentId: batiment.id, nom: `${d.titre.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}.pdf`, typeMime: "application/pdf", taille: donnees.length, donnees, creePar: AUTEUR_COPRO_DEMO },
        select: { id: true },
      });
      ids.documents.push(doc.id);
    }
    await noterIds(ids);

    const [demandes, travaux] = await Promise.all([prisma.demandeCopro.count({ where: { batimentId: batiment.id } }), prisma.travailCopro.count({ where: { batimentId: batiment.id } })]);
    return { unites: ids.unites.length, coproprietaires: ids.coproprietaires.length, demandes, travaux };
  } catch (e) {
    console.error("Copropriété de démonstration : échec du chargement", e);
    await noterIds(ids);
    await retirerCoproDemo().catch((e2) => console.error("Copropriété de démonstration : échec du nettoyage", e2));
    return { erreur: `Le chargement a échoué : ${String(e.message || e).split("\n")[0]}` };
  }
}

// ---------- Retrait ----------

// Retire l'immeuble de démonstration et tout ce qui s'y rattache : unités
// (avec leurs charges, paiements, propriétaires et occupants), copropriétaires,
// espaces, budgets, entretiens, documents, demandes et bons de travail — y
// compris ceux ajoutés à cet immeuble pendant les essais. Les fournisseurs de
// démonstration qui servent ailleurs (dépenses, pièces) restent.
// → { unites, coproprietaires, demandes, travaux } ou { erreur }
export async function retirerCoproDemo() {
  const ids = await lireIds();
  if (!ids) return { erreur: "La copropriété de démonstration n'est pas chargée." };

  const lieu = [{ batimentId: { in: ids.batiments } }, { uniteId: { in: ids.unites } }];
  const resultat = await prisma.$transaction(async (tx) => {
    const demandes = await tx.demandeCopro.findMany({ where: { OR: [...lieu, { coproprietaireId: { in: ids.coproprietaires } }] }, select: { id: true } });
    const demandeIds = demandes.map((d) => d.id);
    const travaux = await tx.travailCopro.deleteMany({ where: { OR: [...lieu, { demandeId: { in: demandeIds } }, { entretienId: { in: ids.entretiens } }] } });
    await tx.demandeCopro.deleteMany({ where: { id: { in: demandeIds } } });
    await tx.documentCopro.deleteMany({ where: { OR: [{ id: { in: ids.documents } }, ...lieu] } });
    await tx.entretienCopro.deleteMany({ where: { OR: [{ id: { in: ids.entretiens } }, { batimentId: { in: ids.batiments } }] } });
    await tx.espaceCopro.deleteMany({ where: { OR: [{ id: { in: ids.espaces } }, ...lieu] } });
    const unites = await tx.uniteCopro.deleteMany({ where: { id: { in: ids.unites } } });
    const coproprietaires = await tx.coproprietaireCopro.deleteMany({ where: { id: { in: ids.coproprietaires } } });
    await tx.batimentCopro.deleteMany({ where: { id: { in: ids.batiments } } });
    await tx.budgetCopro.deleteMany({ where: { id: { in: ids.budgets } } });
    return { unites: unites.count, coproprietaires: coproprietaires.count, demandes: demandeIds.length, travaux: travaux.count };
  }, { timeout: 60000 });

  for (const id of ids.fournisseurs) await prisma.fournisseur.delete({ where: { id } }).catch(() => {});
  await prisma.parametre.deleteMany({ where: { cle: CLE } });
  return resultat;
}
