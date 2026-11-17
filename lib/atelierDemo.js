// Atelier de démonstration (Administrateur → Atelier de démonstration) : de
// quoi présenter le logiciel de base sans rien saisir — clients et véhicules,
// inventaire (dont des pièces sous le minimum), fournisseurs, deux mécaniciens,
// des bons à chaque étape (en attente, chrono en marche, travail fait pas
// encore facturé), dix semaines de factures (payées, payée en partie, en
// retard, avec escompte, remorquage, pneus), soumissions et rendez-vous.
//
// Tout passe par les mêmes fonctions que l'appli (sortie de stock, écritures
// comptables, paiements) : inventaire, comptes clients et grand livre restent
// d'accord entre eux.
//
// Chargé seulement dans un atelier sans bon de travail (la numérotation des
// bons et des factures repart ainsi de 001 une fois la démonstration retirée).
// Les clients, pièces, fournisseurs et employés créés sont notés dans le
// paramètre « atelier_demo » : « Retirer » les efface avec tout ce qui leur
// est rattaché — y compris les bons ajoutés ensuite à ces clients pendant
// les essais — sans toucher aux vrais dossiers.

import crypto from "crypto";
import { prisma } from "./prisma";
import { estVr } from "./client";
import { hashPassword } from "./auth";
import { dateAujourdhuiQuebec, dateHeureQuebecVersUTC } from "./temps";
import { prochainNumeroBon, prochainNumeroFacture, prochainNumeroSoumission, prochainNumeroClient, prochainNumeroFournisseur, prochainNumeroEmploye } from "./numerotation";
import { sortirDuStockPourBon, remettreLigneEnStock } from "./bons";
import { posterFactureEmise, alignerInventaireAuGL } from "./comptabilite";
import { assurerComptesTresorerie } from "./tresorerie";
import { enregistrerPaiements, soldeFacture } from "./paiementsFactures";
import { totauxLignesFixes } from "./piecesSoumission";
import { heuresFacturablesTache } from "./kits";
import { montantMaterielAtelier } from "./materielAtelier";
import { montantEscompte } from "./escompte";

export const AUTEUR_ATELIER_DEMO = "Atelier de démonstration";
const CLE = "atelier_demo";

// ---------- Données ----------

const EMPLOYES = [
  { nom: "Alex Gagné (démo)", courriel: "alex.demo@demonstration.invalid", assignation: "Mécanique générale", tauxHoraireEmploye: 34 },
  { nom: "Maude Lavoie (démo)", courriel: "maude.demo@demonstration.invalid", assignation: "Freins et suspension", tauxHoraireEmploye: 30 },
];

const FOURNISSEURS = [
  { nom: "Pièces d'auto Rive-Sud", telephone: "450-555-0110", courriel: "commandes@piecesrivesud.example", adresse: "1250 boul. Industriel", ville: "Saint-Jean-sur-Richelieu", province: "QC", codePostal: "J3B 7W5" },
  { nom: "Pneus Montérégie", telephone: "450-555-0125", courriel: "ventes@pneusmonteregie.example", adresse: "88 rue des Érables", ville: "Chambly", province: "QC", codePostal: "J3L 2B4" },
  { nom: "Lubrifiants Québec", telephone: "514-555-0140", courriel: "service@lubrifiantsqc.example", ville: "Longueuil", province: "QC" },
];

// [numéro, nom, quantité, minimum, coûtant, prix, emplacement, fournisseur, catégorie]
const PIECES = [
  ["FH-1001", "Filtre à huile", 24, 6, 6.5, 12.99, "A-01-01", 0],
  ["HM-5W30", "Huile moteur synthétique 5W-30 (litre)", 80, 20, 5.2, 10.5, "A-01-02", 2],
  ["FA-2040", "Filtre à air", 10, 4, 11, 24.99, "A-01-03", 0],
  ["PF-4410", "Plaquettes de frein avant (jeu)", 4, 4, 38, 84.5, "B-02-01", 0],
  ["DF-4420", "Disque de frein avant", 6, 4, 46, 98, "B-02-02", 0],
  ["LF-DOT4", "Liquide de frein DOT 4 (500 ml)", 12, 4, 6, 13.5, "B-02-03", 2],
  ["BAT-51R", "Batterie 12 V groupe 51R", 3, 3, 96, 189, "C-01-01", 0],
  ["CS-6PK", "Courroie d'accessoires", 6, 3, 21, 46.5, "C-02-01", 0],
  ["BG-IRI", "Bougie d'allumage iridium", 24, 8, 8.4, 18.99, "C-02-02", 0],
  ["AM-3310", "Amortisseur avant", 5, 2, 72, 149, "D-01-01", 0],
  ["EG-22", "Balai d'essuie-glace 22 po", 14, 6, 7.5, 19.99, "A-03-01", 0],
  ["LG-40", "Lave-glace −40 °C (3,78 L)", 30, 10, 2.4, 5.99, "A-03-02", 2],
  ["PN-H2055516", "Pneu d'hiver 205/55R16", 10, 8, 98, 174, "P-01", 1, "PNEU"],
  ["PN-H2256517", "Pneu d'hiver 225/65R17", 4, 8, 124, 219, "P-02", 1, "PNEU"],
];

const CLIENTS = [
  { nom: "Jean Tremblay", telephone: "450-555-0201", courriel: "jean.tremblay@example.com", adresse: "412 rue Champlain", ville: "Saint-Jean-sur-Richelieu", province: "QC", codePostal: "J3B 6V9" },
  { nom: "Sylvie Bouchard", telephone: "450-555-0202", courriel: "sylvie.bouchard@example.com", adresse: "27 rue Martel", ville: "Chambly", province: "QC", codePostal: "J3L 1V3" },
  { nom: "Marc Gagnon", telephone: "514-555-0203", courriel: "marc.gagnon@example.com", ville: "Longueuil", province: "QC", garantieProlongee: "GP-88213" },
  { nom: "Nathalie Roy", telephone: "450-555-0204", courriel: "nathalie.roy@example.com", ville: "Saint-Luc", province: "QC" },
  { nom: "Transport Richelieu inc.", telephone: "450-555-0205", courriel: "comptabilite@transportrichelieu.example", adresse: "800 boul. du Séminaire Nord", ville: "Saint-Jean-sur-Richelieu", province: "QC", codePostal: "J3A 1B5" },
  { nom: "Éric Simard", telephone: "450-555-0206", ville: "Iberville", province: "QC" },
  { nom: "Julie Côté", telephone: "438-555-0207", courriel: "julie.cote@example.com", ville: "Brossard", province: "QC" },
  { nom: "Patrick Lévesque", telephone: "450-555-0208", courriel: "patrick.levesque@example.com", ville: "Marieville", province: "QC" },
];

// Un véhicule par ligne : [client, année, marque, modèle, version, plaque, kilométrage, NIV]
const VEHICULES_AUTO = [
  [0, 2019, "Honda", "Civic", "EX", "N42 KTR", 84200, "2HGFC2F79KH512345"],
  [1, 2021, "Toyota", "RAV4", "XLE", "Y08 BDM", 46800, "2T3R1RFV1MW123456"],
  [2, 2017, "Ford", "F-150", "XLT", "FKT 4471", 142300, "1FTEW1EP5HFA12345"],
  [3, 2018, "Hyundai", "Elantra", "GL", "W15 LPN", 97500, null],
  [4, 2020, "Ram", "ProMaster", "2500", "FMR 2096", 118900, null],
  [4, 2022, "Ford", "Transit", "250", "FNH 7730", 61200, null],
  [5, 2016, "Subaru", "Outback", "Touring", "H77 QCS", 163400, null],
  [6, 2023, "Mazda", "CX-5", "GS", "Z31 RVE", 21700, null],
  [7, 2015, "Chevrolet", "Silverado", "LT", "FJX 5518", 188600, null],
];
const VEHICULES_VR = [
  [0, 2019, "Jayco", "Jay Flight", "24RBS", "RA 41872", null, null],
  [1, 2021, "Winnebago", "Minnie Winnie", "25B", "Y08 BDM", 46800, null],
  [2, 2017, "Forest River", "Rockwood", "2109S", "RB 20417", null, null],
  [3, 2018, "Keystone", "Passport", "2400BH", "RC 77103", null, null],
  [4, 2020, "Thor Motor Coach", "Four Winds", "28Z", "FMR 2096", 118900, null],
  [4, 2022, "Coachmen", "Freelander", "27QB", "FNH 7730", 61200, null],
  [5, 2016, "Roadtrek", "Zion", "SRT", "H77 QCS", 163400, null],
  [6, 2023, "Grand Design", "Imagine", "2500RL", "RD 55120", null, null],
  [7, 2015, "Fleetwood", "Bounder", "33C", "FJX 5518", 188600, null],
];

// Bons de travail. ilYA : jours avant aujourd'hui (ramené au jour ouvrable
// précédent). Chaque tâche : heures poinçonnées (h), pièces [numéro, qté],
// poste de revenu autre que la main-d'œuvre (poste + ligne de facturation).
// facture : émise le jour du travail ; paiement : mode (payée au complet),
// { partiel } ou rien (impayée).
const BONS = [
  { vehicule: 0, ilYA: 68, mecano: 0, facture: true, paiement: "CARTE_DEBIT", taches: [
    { description: "Changement d'huile et filtre", notes: "Huile synthétique 5W-30, filtre remplacé. Niveaux vérifiés.", h: 0.6, pieces: [["FH-1001", 1], ["HM-5W30", 5]] },
    { description: "Inspection en 20 points", notes: "Rien à signaler. Plaquettes avant à surveiller à la prochaine visite.", h: 0.4 },
  ] },
  { vehicule: 2, ilYA: 60, mecano: 1, facture: true, paiement: "CARTE_CREDIT", taches: [
    { description: "Remplacement des plaquettes et des disques avant", notes: "Disques sous la cote d'usure. Étriers nettoyés et lubrifiés.", h: 1.8, pieces: [["PF-4410", 1], ["DF-4420", 2]] },
    { description: "Purge du liquide de frein", h: 0.5, pieces: [["LF-DOT4", 2]] },
  ] },
  { vehicule: 4, ilYA: 55, mecano: 0, facture: true, paiement: "VIREMENT", taches: [
    { description: "Remorquage du véhicule en panne", poste: "4050", ligne: ["Remorquage — Saint-Luc à l'atelier", 135, 1], h: 0.75 },
    { description: "Diagnostic : ne démarre pas", notes: "Batterie à plat, cellule morte. Alternateur testé : conforme.", h: 0.8 },
    { description: "Remplacement de la batterie", h: 0.4, pieces: [["BAT-51R", 1]] },
  ] },
  { vehicule: 3, ilYA: 47, mecano: 1, facture: true, paiement: null, taches: [
    { description: "Remplacement de la courroie d'accessoires", notes: "Courroie fissurée. Tendeur en bon état.", h: 1.1, pieces: [["CS-6PK", 1]] },
    { description: "Remplacement des bougies", h: 0.9, pieces: [["BG-IRI", 4]] },
  ] },
  { vehicule: 6, ilYA: 39, mecano: 0, facture: true, paiement: "INTERAC", taches: [
    { description: "Remplacement des amortisseurs avant", notes: "Fuite d'huile sur l'amortisseur gauche. Remplacés en paire.", h: 2.6, pieces: [["AM-3310", 2]] },
    { description: "Alignement des 4 roues", poste: "4030", ligne: ["Alignement des 4 roues", 109.95, 1], h: 0.8 },
  ] },
  { vehicule: 1, ilYA: 33, mecano: 1, facture: true, paiement: "CARTE_CREDIT", escompte: [10, "Cliente fidèle"], taches: [
    { description: "Pose de 4 pneus d'hiver neufs", notes: "Équilibrage fait, pression ajustée à 35 lb/po².", h: 1.2, pieces: [["PN-H2256517", 4]] },
    { description: "Entreposage des pneus d'été", poste: "4040", ligne: ["Entreposage de pneus — saison", 80, 1], h: 0.2 },
  ] },
  { vehicule: 8, ilYA: 26, mecano: 0, facture: true, paiement: { partiel: 300, mode: "CHEQUE", reference: "1047" }, taches: [
    { description: "Diagnostic : bruit à l'avant en freinant", notes: "Plaquettes au métal, disques rayés.", h: 0.7 },
    { description: "Remplacement des plaquettes et des disques avant", h: 2, pieces: [["PF-4410", 1], ["DF-4420", 2]] },
  ] },
  { vehicule: 5, ilYA: 18, mecano: 1, facture: true, paiement: "CARTE_DEBIT", taches: [
    { description: "Changement d'huile et filtre", h: 0.6, pieces: [["FH-1001", 1], ["HM-5W30", 6]] },
    { description: "Remplacement du filtre à air et des essuie-glaces", h: 0.3, pieces: [["FA-2040", 1], ["EG-22", 2], ["LG-40", 1]] },
  ] },
  { vehicule: 0, ilYA: 12, mecano: 0, facture: true, paiement: "COMPTANT", taches: [
    { description: "Pose de 4 pneus d'hiver neufs", h: 1.1, pieces: [["PN-H2055516", 4]] },
  ] },
  { vehicule: 2, ilYA: 5, mecano: 1, facture: true, paiement: null, taches: [
    { description: "Remplacement de la batterie", notes: "Bornes nettoyées, système de charge vérifié.", h: 0.5, pieces: [["BAT-51R", 1]] },
    { description: "Changement d'huile et filtre", h: 0.7, pieces: [["FH-1001", 1], ["HM-5W30", 7]] },
  ] },
  // Travail fait hier, pas encore facturé
  { vehicule: 3, ilYA: 1, mecano: 0, taches: [
    { description: "Changement d'huile et filtre", notes: "Fait. Prêt à facturer.", h: 0.6, pieces: [["FH-1001", 1], ["HM-5W30", 4]] },
    { description: "Remplacement des essuie-glaces", h: 0.2, pieces: [["EG-22", 2]] },
  ] },
  // En cours : un chrono en marche depuis 40 minutes
  { vehicule: 5, ilYA: 0, mecano: 1, taches: [
    { description: "Remplacement des plaquettes de frein avant", pieces: [["PF-4410", 1]], actifMinutes: 40 },
    { description: "Vérification du bruit de roulement arrière" },
  ] },
  // En attente
  { vehicule: 7, ilYA: 0, taches: [{ description: "Témoin moteur allumé — lecture des codes" }] },
  { vehicule: 1, ilYA: -1, rendezVous: "Changement d'huile", taches: [{ description: "Changement d'huile et filtre" }, { description: "Rotation des pneus" }] },
];

// ---------- Outils ----------

// Journée civile au Québec, n jours avant aujourd'hui (n négatif : après),
// ramenée à un jour de semaine — en reculant pour le passé, en avançant
// pour l'avenir
function jourOuvrable(n) {
  const d = new Date(`${dateAujourdhuiQuebec()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + (n > 0 ? -1 : 1));
  return d.toISOString().slice(0, 10);
}
const heureLocale = (jour, heures) => dateHeureQuebecVersUTC(jour, `${Math.floor(heures)}:${String(Math.round((heures % 1) * 60)).padStart(2, "0")}`);

// Les dossiers notés au chargement — null si rien n'est chargé, ou si les
// données ont été effacées depuis (Réinitialisation garde les paramètres)
async function lireIds() {
  const p = await prisma.parametre.findUnique({ where: { cle: CLE } });
  if (!p) return null;
  let ids;
  try { ids = JSON.parse(p.valeur); } catch { return null; }
  const reste = await Promise.all([
    prisma.client.count({ where: { id: { in: ids.clients } } }), prisma.piece.count({ where: { id: { in: ids.pieces } } }),
    prisma.user.count({ where: { id: { in: ids.employes } } }), prisma.fournisseur.count({ where: { id: { in: ids.fournisseurs } } }),
  ]);
  return reste.some((n) => n > 0) ? ids : null;
}
const noterIds = (ids) => prisma.parametre.upsert({ where: { cle: CLE }, update: { valeur: JSON.stringify(ids) }, create: { cle: CLE, valeur: JSON.stringify(ids) } });

// → { charge, clients, bons, bonsAtelier } : ce que la démonstration contient
// encore, et le nombre de bons de l'atelier (0 : elle peut se charger)
export async function etatAtelierDemo() {
  const ids = await lireIds();
  const [bonsAtelier, clients, bons] = await Promise.all([
    prisma.bonTravail.count(),
    ids ? prisma.client.count({ where: { id: { in: ids.clients } } }) : 0,
    ids ? prisma.bonTravail.count({ where: { clientId: { in: ids.clients } } }) : 0,
  ]);
  return { charge: !!ids, clients, bons, bonsAtelier };
}

// Émet la facture du bon à la date donnée — même calcul que
// POST /api/bons/[id]/facturer
async function facturer(bonId, date, dict) {
  const bon = await prisma.bonTravail.findUnique({
    where: { id: bonId },
    include: { problemes: { include: { pieces: { include: { piece: true } }, entreesTemps: true } } },
  });
  const tauxHoraire = Number(dict.taux_horaire_client || 195);
  const lignesFixes = totauxLignesFixes(bon.problemes);
  const totalPieces = lignesFixes.pieces + bon.problemes.reduce((s, pr) => s + pr.pieces.reduce((s2, l) => s2 + l.qte * l.prix, 0), 0);
  const heuresFacturees = bon.problemes.reduce((s, pr) => s + heuresFacturablesTache(pr), 0);
  const totalMainOeuvre = heuresFacturees * tauxHoraire;
  const totalMaterielAtelier = montantMaterielAtelier(heuresFacturees);
  const sousTotal = totalPieces + totalMainOeuvre + lignesFixes.autres + totalMaterielAtelier;
  const escompte = montantEscompte(bon, sousTotal);
  const totalFacture = sousTotal - escompte;
  const tpsMontant = totalFacture * (Number(dict.tps_taux || 5) / 100);
  const tvqMontant = totalFacture * (Number(dict.tvq_taux || 9.975) / 100);
  const facture = await prisma.facture.create({
    data: {
      bonId, numero: await prochainNumeroFacture(), dateEmission: date,
      totalPieces, totalMainOeuvre, totalAutresRevenus: lignesFixes.autres, totalMaterielAtelier, escompteApplique: escompte, totalFacture,
      tauxHoraireUtilise: tauxHoraire, heuresFacturees, tpsMontant, tvqMontant, totalAvecTaxes: totalFacture + tpsMontant + tvqMontant,
    },
  });
  await prisma.bonTravail.update({ where: { id: bonId }, data: { statut: "TERMINE" } });
  await posterFactureEmise(bon, facture, AUTEUR_ATELIER_DEMO);
  return facture;
}

// ---------- Chargement ----------

// → { clients, bons, factures } ou { erreur }
export async function chargerAtelierDemo() {
  if (await lireIds()) return { erreur: "L'atelier de démonstration est déjà chargé." };
  if ((await prisma.bonTravail.count()) > 0) return { erreur: "L'atelier contient déjà des bons de travail : l'atelier de démonstration ne se charge que dans un atelier sans bon." };
  const dejaLa = await prisma.piece.findMany({ where: { numero: { in: PIECES.map((p) => p[0]) } }, select: { numero: true } });
  if (dejaLa.length > 0) return { erreur: `L'inventaire contient déjà des pièces aux numéros de la démonstration (${dejaLa.map((p) => p.numero).join(", ")}).` };

  const ids = { clients: [], pieces: [], fournisseurs: [], employes: [], soumissions: [], rendezVous: [] };
  try {
    await noterIds(ids);
    const parametres = await prisma.parametre.findMany({ where: { cle: { in: ["taux_horaire_client", "tps_taux", "tvq_taux"] } } });
    const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
    await assurerComptesTresorerie();
    const comptes = await prisma.compteTresorerie.findMany({ where: { actif: true }, include: { compte: true }, orderBy: { ordre: "asc" } });
    const banque = comptes.find((c) => c.categorie === "BANQUE") || comptes[0];
    const caisse = comptes.find((c) => c.categorie === "CAISSE") || banque;

    // Employés : mot de passe au hasard, jamais communiqué — ils servent à
    // porter les heures, pas à se connecter
    const employes = [];
    for (const e of EMPLOYES) {
      employes.push(await prisma.user.create({
        data: { ...e, role: "MECANICIEN", numeroEmploye: await prochainNumeroEmploye(), motDePasse: await hashPassword(crypto.randomBytes(24).toString("hex")), dateEmbauche: heureLocale(jourOuvrable(400), 12) },
      }));
      ids.employes.push(employes.at(-1).id);
    }
    const fournisseurs = [];
    for (const f of FOURNISSEURS) {
      fournisseurs.push(await prisma.fournisseur.create({ data: { ...f, numero: await prochainNumeroFournisseur() } }));
      ids.fournisseurs.push(fournisseurs.at(-1).id);
    }
    const pieces = {};
    for (const [numero, nom, qte, qteMin, coutant, prix, emplacement, fournisseur, categorie = "PIECE"] of PIECES) {
      pieces[numero] = await prisma.piece.create({
        data: {
          numero, nom, qte, qteMin, qteMax: qteMin * 4, coutant, prix, emplacement, categorie, fournisseurId: fournisseurs[fournisseur].id,
          mouvements: { create: { type: "AJUSTEMENT", qte, solde: qte, note: "Stock de départ", creePar: AUTEUR_ATELIER_DEMO } },
        },
      });
      ids.pieces.push(pieces[numero].id);
    }
    await noterIds(ids);
    // Valeur du stock de départ au grand livre (comme à la création d'une pièce)
    await alignerInventaireAuGL(AUTEUR_ATELIER_DEMO, "Stock de départ de la démonstration");

    const clients = [];
    for (const c of CLIENTS) {
      clients.push(await prisma.client.create({ data: { ...c, numero: await prochainNumeroClient(), creeLe: heureLocale(jourOuvrable(75), 9) } }));
      ids.clients.push(clients.at(-1).id);
    }
    await noterIds(ids);
    const vehicules = [];
    for (const [client, annee, marque, modele, version, plaque, kilometrage, niv] of estVr ? VEHICULES_VR : VEHICULES_AUTO) {
      vehicules.push(await prisma.vehicule.create({ data: { clientId: clients[client].id, annee, marque, modele, version, plaque, kilometrage, niv } }));
    }
    const libelle = (v) => `${v.annee} ${v.marque} ${v.modele}`;

    // Bons, du plus ancien au plus récent (numéros dans l'ordre)
    let nbFactures = 0;
    const bonsCrees = [];
    for (const b of BONS) {
      const vehicule = vehicules[b.vehicule];
      const client = clients.find((c) => c.id === vehicule.clientId);
      const jour = jourOuvrable(b.ilYA);
      const arrivee = heureLocale(jour, 8.5);
      const bon = await prisma.bonTravail.create({
        data: {
          numero: await prochainNumeroBon(), clientId: client.id, vehiculeId: vehicule.id, kilometrage: vehicule.kilometrage,
          creeLe: b.ilYA > 0 ? arrivee : new Date(), datePrevue: b.ilYA < 0 ? heureLocale(jour, 9) : null,
          escomptePourcent: b.escompte?.[0] || 0, escompteRaison: b.escompte?.[1] || null,
          problemes: {
            create: b.taches.map((t) => ({
              description: t.description, notes: t.notes || null,
              ...(t.poste && { categorieRevenu: t.poste, factureDescription: t.ligne[0], facturePrixUnitaire: t.ligne[1], factureQte: t.ligne[2] }),
            })),
          },
          ...(b.rendezVous && {
            rendezVous: { create: { clientId: client.id, clientNom: client.nom, clientTelephone: client.telephone, vehiculeInfo: libelle(vehicule), date: heureLocale(jour, 9), dureeMinutes: 60, motif: b.rendezVous, source: "BON" } },
          }),
        },
        include: { problemes: { orderBy: { id: "asc" } } },
      });
      bonsCrees.push(bon);
      // Les tâches reviennent dans l'ordre de création (ids croissants) ; par
      // sûreté, on les retrouve par leur description
      let heure = 8.75;
      let aDuTemps = false;
      for (const t of b.taches) {
        const probleme = bon.problemes.find((p) => p.description === t.description);
        for (const [numero, quantite] of t.pieces || []) {
          await prisma.$transaction(async (tx) => {
            const piece = await tx.piece.findUnique({ where: { id: pieces[numero].id } });
            await sortirDuStockPourBon(tx, { probleme: { ...probleme, bon: { numero: bon.numero, client } }, piece, quantite, creePar: AUTEUR_ATELIER_DEMO });
          });
        }
        const employeId = employes[b.mecano ?? 0].id;
        if (t.h) {
          await prisma.entreeTemps.create({ data: { employeId, problemeId: probleme.id, debut: heureLocale(jour, heure), fin: heureLocale(jour, heure + t.h) } });
          heure += t.h + 0.1;
          aDuTemps = true;
        }
        if (t.actifMinutes) {
          await prisma.entreeTemps.create({ data: { employeId, problemeId: probleme.id, debut: new Date(Date.now() - t.actifMinutes * 60000) } });
          aDuTemps = true;
        }
      }
      if (aDuTemps) await prisma.bonTravail.update({ where: { id: bon.id }, data: { statut: "EN_COURS" } });
      if (!b.facture) continue;

      const dateFacture = heureLocale(jour, Math.max(heure + 0.5, 15));
      const facture = await facturer(bon.id, dateFacture, dict);
      nbFactures++;
      if (b.paiement && banque) {
        const partiel = typeof b.paiement === "object";
        const mode = partiel ? b.paiement.mode : b.paiement;
        await enregistrerPaiements(facture.id, [{
          montant: partiel ? b.paiement.partiel : soldeFacture(facture), modePaiement: mode,
          compteTresorerieId: (mode === "COMPTANT" ? caisse : banque).id, reference: partiel ? b.paiement.reference : null,
        }], { creePar: AUTEUR_ATELIER_DEMO, date: partiel ? heureLocale(jourOuvrable(b.ilYA - 7), 11) : dateFacture });
      }
    }

    // Soumissions : une en attente avec des pièces de l'inventaire, une pour
    // un prospect sans dossier, une acceptée (devenue le bon prévu demain)
    const soumission = async (data) => {
      const s = await prisma.soumission.create({ data: { numero: await prochainNumeroSoumission(), ...data } });
      ids.soumissions.push(s.id);
    };
    await soumission({
      clientId: clients[2].id, clientNom: clients[2].nom, clientTelephone: clients[2].telephone, vehiculeId: vehicules[2].id, vehiculeInfo: libelle(vehicules[2]), creeLe: heureLocale(jourOuvrable(3), 10),
      taches: { create: [
        { description: "Remplacement des amortisseurs avant", tempsEstime: 2.5, pieces: { create: [{ nom: pieces["AM-3310"].nom, prixEstime: pieces["AM-3310"].prix, qte: 2, pieceId: pieces["AM-3310"].id }] } },
        { description: "Alignement des 4 roues", tempsEstime: 1 },
      ] },
    });
    await soumission({
      clientNom: "Caroline Dubé", clientTelephone: "450-555-0231", clientVille: "Saint-Jean-sur-Richelieu", clientProvince: "QC", vehiculeInfo: estVr ? "2020 Jayco Eagle" : "2014 Volkswagen Jetta", creeLe: heureLocale(jourOuvrable(1), 14),
      taches: { create: [
        { description: estVr ? "Réparation de la toile de l'auvent" : "Remplacement de l'embrayage", tempsEstime: 5, pieces: { create: [{ nom: estVr ? "Toile d'auvent 16 pi" : "Ensemble d'embrayage complet", prixEstime: 485, qte: 1 }] } },
        { description: "Changement d'huile et filtre", tempsEstime: 0.6, pieces: { create: [{ nom: pieces["FH-1001"].nom, prixEstime: pieces["FH-1001"].prix, qte: 1, pieceId: pieces["FH-1001"].id }, { nom: pieces["HM-5W30"].nom, prixEstime: pieces["HM-5W30"].prix, qte: 5, pieceId: pieces["HM-5W30"].id }] } },
      ] },
    });
    const bonPrevu = bonsCrees.at(-1);
    await soumission({
      clientId: clients[1].id, clientNom: clients[1].nom, clientTelephone: clients[1].telephone, vehiculeId: vehicules[1].id, vehiculeInfo: libelle(vehicules[1]),
      statut: "ACCEPTEE", bonId: bonPrevu.id, creeLe: heureLocale(jourOuvrable(2), 11),
      taches: { create: [{ description: "Changement d'huile et filtre", tempsEstime: 0.6 }, { description: "Rotation des pneus", tempsEstime: 0.4 }] },
    });

    // Rendez-vous à venir (et un d'hier, complété)
    const rendezVous = async (ilYA, heure, data) => {
      const r = await prisma.rendezVous.create({ data: { date: heureLocale(jourOuvrable(ilYA), heure), ...data } });
      ids.rendezVous.push(r.id);
    };
    const duClient = (i, v) => ({ clientId: clients[i].id, clientNom: clients[i].nom, clientTelephone: clients[i].telephone, clientCourriel: clients[i].courriel, vehiculeInfo: libelle(vehicules[v]) });
    await rendezVous(1, 13, { ...duClient(3, 3), motif: "Changement d'huile", statut: "COMPLETE" });
    await rendezVous(-1, 13.5, { ...duClient(0, 0), motif: "Inspection avant l'hiver", dureeMinutes: 45 });
    await rendezVous(-2, 9, { ...duClient(6, 7), motif: "Entretien 24 000 km", dureeMinutes: 90 });
    await rendezVous(-3, 10.5, { ...duClient(4, 5), motif: "Freins avant — vérification", dureeMinutes: 60 });
    await rendezVous(-3, 14, { clientNom: "Caroline Dubé", clientTelephone: "450-555-0231", vehiculeInfo: estVr ? "2020 Jayco Eagle" : "2014 Volkswagen Jetta", motif: "Estimation", dureeMinutes: 30 });
    await rendezVous(-6, 11, { clientNom: "Représentant — Pièces d'auto Rive-Sud", motif: "Rencontre du fournisseur", note: "Rendez-vous d'affaires, sans lien avec un véhicule", dureeMinutes: 45 });
    await noterIds(ids);

    return { clients: clients.length, bons: bonsCrees.length, factures: nbFactures };
  } catch (e) {
    console.error("Atelier de démonstration : échec du chargement", e);
    await noterIds(ids);
    await retirerAtelierDemo().catch((e2) => console.error("Atelier de démonstration : échec du nettoyage", e2));
    return { erreur: `Le chargement a échoué : ${String(e.message || e).replace(/^PERIODE_LOCK:/, "").split("\n")[0]}` };
  }
}

// ---------- Retrait ----------

// Retire les clients de démonstration et tout ce qui leur est rattaché :
// véhicules, bons (y compris ceux ajoutés pendant les essais), factures,
// paiements, dépôts, crédits, écritures comptables, soumissions et
// rendez-vous ; puis les pièces, fournisseurs et employés de démonstration
// qui ne servent pas ailleurs (ceux qui servent à un vrai dossier restent).
// → { clients, bons, pieces, gardes } ou { erreur }
export async function retirerAtelierDemo() {
  const ids = await lireIds();
  if (!ids) return { erreur: "L'atelier de démonstration n'est pas chargé." };

  const bons = await prisma.bonTravail.findMany({
    where: { clientId: { in: ids.clients } },
    select: { id: true, numero: true, facture: { select: { id: true } }, problemes: { select: { pieces: true } } },
  });
  const bonIds = bons.map((b) => b.id);
  const factureIds = bons.map((b) => b.facture?.id).filter(Boolean);
  const soumissionsOu = [{ clientId: { in: ids.clients } }, { id: { in: ids.soumissions } }, { bonId: { in: bonIds } }];
  const [paiements, depots, credits, ventes] = await Promise.all([
    prisma.paiementFacture.findMany({ where: { factureId: { in: factureIds } }, select: { ecritureId: true } }),
    prisma.depotClient.findMany({ where: { OR: [{ bonId: { in: bonIds } }, { soumission: { OR: soumissionsOu } }] }, select: { id: true, ecritureId: true } }),
    prisma.creditClient.findMany({ where: { clientId: { in: ids.clients } }, select: { ecritureId: true } }),
    prisma.factureVente.count({ where: { clientId: { in: ids.clients } } }),
  ]);
  if (ventes > 0) return { erreur: "Un véhicule à vendre a été vendu à un client de démonstration : annule d'abord cette vente." };
  const ecritureIds = [...paiements, ...depots, ...credits].map((x) => x.ecritureId).filter(Boolean);
  const ecrituresOu = { OR: [{ creePar: AUTEUR_ATELIER_DEMO }, { sourceId: { in: factureIds } }, { id: { in: ecritureIds } }] };
  const concilie = await prisma.ligneEcriture.count({ where: { ecriture: ecrituresOu, OR: [{ rapprochementId: { not: null } }, { transactionBancaireId: { not: null } }] } });
  if (concilie > 0) return { erreur: "Des paiements de démonstration sont associés à une transaction bancaire ou à une conciliation : annule-les d'abord (Comptabilité)." };

  const pieceDemo = new Set(ids.pieces);
  await prisma.$transaction(async (tx) => {
    // Vraies pièces mises sur un bon de démonstration pendant les essais :
    // elles reviennent en stock (celles de démonstration disparaissent)
    for (const bon of bons) {
      for (const ligne of bon.problemes.flatMap((p) => p.pieces)) {
        if (!pieceDemo.has(ligne.pieceId)) await remettreLigneEnStock(tx, ligne, { note: `Bon #${bon.numero} retiré (démonstration)`, creePar: AUTEUR_ATELIER_DEMO });
      }
    }
    await tx.ecritureComptable.deleteMany({ where: ecrituresOu });
    await tx.creditClient.deleteMany({ where: { clientId: { in: ids.clients } } });
    await tx.depotClient.deleteMany({ where: { id: { in: depots.map((d) => d.id) } } });
    await tx.facture.deleteMany({ where: { id: { in: factureIds } } });
    await tx.rendezVous.deleteMany({ where: { OR: [{ clientId: { in: ids.clients } }, { id: { in: ids.rendezVous } }, { bonId: { in: bonIds } }] } });
    await tx.soumission.deleteMany({ where: { OR: soumissionsOu } });
    await tx.bonTravail.deleteMany({ where: { id: { in: bonIds } } });
    await tx.client.deleteMany({ where: { id: { in: ids.clients } } });
  }, { timeout: 60000 });

  // Ce qui sert encore à un vrai dossier (pièce sur un vrai bon, heures d'un
  // employé…) ne se supprime pas : gardé, l'employé désactivé
  let pieces = 0;
  let gardes = 0;
  const supprimer = async (modele, id) => {
    try { await prisma[modele].delete({ where: { id } }); return true; } catch { gardes++; return false; }
  };
  for (const id of ids.pieces) if (await supprimer("piece", id)) pieces++;
  for (const id of ids.fournisseurs) await supprimer("fournisseur", id);
  for (const id of ids.employes) {
    if (!(await supprimer("user", id))) await prisma.user.updateMany({ where: { id }, data: { actif: false } });
  }
  await prisma.parametre.deleteMany({ where: { cle: CLE } });
  return { clients: ids.clients.length, bons: bons.length, pieces, gardes };
}
