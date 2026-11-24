// Vérifie les calculs des retards et de « À faire » de l'immobilier
// (lib/immobilierCalculs.js) : loyer à recevoir ou en retard, imputation des
// paiements et des crédits, seuil de trois semaines du TAL, délais d'avis.
//
//   node scripts/tester-immobilier.mjs
//
// Aucune base de données n'est lue.
import assert from "node:assert/strict";
import { register } from "node:module";

// Les modules de lib/ s'importent sans extension (« ./format ») : on l'ajoute
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    try { return await next(specifier, context); }
    catch (e) { if (/^\\.\\.?\\//.test(specifier) && !/\\.[cm]?js$/.test(specifier)) return next(specifier + ".js", context); throw e; }
  }
`));
const {
  etatCompte, etatRetard, additionnerComptes, aSurveillerBail, finReponseAvis, JOURS_RETARD_TAL,
  periodeTal, pourcentageBase, excedentHausse, calculHausseTal, loyersImmeuble, haussesImmeuble, debutHausse,
  etatRevenusLocation, ligneT776,
} = await import("../lib/immobilierCalculs.js");
const { piecesParDefaut, piecesPourSortie, comparerAEntree, dommagesDepuisEntree, avancement, normaliserPieces } = await import("../lib/etatsLieuxCalculs.js");

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis += 1; console.log(`✓ ${nom}`); } catch (e) { console.error(`✗ ${nom}\n  ${e.message}`); process.exitCode = 1; }
}
const egal = (obtenu, attendu, quoi) => assert.ok(Math.abs(obtenu - attendu) < 0.006, `${quoi} : obtenu ${obtenu}, attendu ${attendu}`);
const jour = (iso) => new Date(`${iso}T12:00:00Z`); // dates enregistrées à midi UTC
const midiQc = (iso) => new Date(`${iso}T17:00:00Z`); // « maintenant » : midi, heure du Québec
const loyer = (iso, montant = 1000) => ({ date: jour(iso), montant });

test("Loyer inscrit d'avance : à recevoir, pas en retard", () => {
  const c = etatCompte({ charges: [loyer("2026-12-01")], paiements: [] }, midiQc("2026-11-25"));
  egal(c.solde, 1000, "solde");
  egal(c.enRetard, 0, "en retard");
  egal(c.aRecevoir, 1000, "à recevoir");
  assert.equal(c.joursRetard, 0);
  assert.equal(etatRetard(c), null);
});

test("Le jour de l'échéance, le loyer est dû mais pas encore en retard", () => {
  const c = etatCompte({ charges: [loyer("2026-12-01")], paiements: [] }, midiQc("2026-12-01"));
  egal(c.enRetard, 0, "en retard");
  egal(c.aRecevoir, 1000, "à recevoir");
});

test("Le lendemain de l'échéance, en retard depuis 1 jour", () => {
  const c = etatCompte({ charges: [loyer("2026-12-01")], paiements: [] }, midiQc("2026-12-02"));
  egal(c.enRetard, 1000, "en retard");
  assert.equal(c.joursRetard, 1);
  assert.equal(c.depuis.toISOString().slice(0, 10), "2026-12-01");
});

test("Tard le soir au Québec (déjà le lendemain en UTC), on reste au bon jour", () => {
  const c = etatCompte({ charges: [loyer("2026-12-01")], paiements: [] }, new Date("2026-12-02T04:30:00Z")); // 1er déc., 23 h 30 à Montréal
  egal(c.enRetard, 0, "en retard");
});

test("Les paiements couvrent d'abord le plus ancien loyer", () => {
  const charges = [loyer("2026-10-01"), loyer("2026-11-01"), loyer("2026-12-01")];
  const c = etatCompte({ charges, paiements: [{ montant: 1000 }] }, midiQc("2026-11-20"));
  // Octobre payé ; novembre en retard (19 jours) ; décembre à recevoir
  egal(c.enRetard, 1000, "en retard");
  egal(c.aRecevoir, 1000, "à recevoir");
  assert.equal(c.joursRetard, 19);
  assert.equal(c.tal, false);
});

test("Paiement partiel : le reste du mois est en retard depuis son échéance", () => {
  const c = etatCompte({ charges: [loyer("2026-11-01")], paiements: [{ montant: 400 }] }, midiQc("2026-11-10"));
  egal(c.enRetard, 600, "en retard");
  assert.equal(c.joursRetard, 9);
});

test("Plus de trois semaines : seuil du TAL", () => {
  const charges = [loyer("2026-11-01")];
  assert.equal(etatCompte({ charges, paiements: [] }, midiQc(`2026-11-${String(1 + JOURS_RETARD_TAL).padStart(2, "0")}`)).tal, false, "21 jours : pas encore");
  const c = etatCompte({ charges, paiements: [] }, midiQc("2026-11-23"));
  assert.equal(c.joursRetard, 22);
  assert.equal(c.tal, true);
  assert.equal(etatRetard(c).code, "TAL");
});

test("Un crédit (loyer remis) couvre le plus ancien montant dû", () => {
  const charges = [loyer("2026-10-01"), { date: jour("2026-10-15"), montant: -1000 }, loyer("2026-11-01")];
  const c = etatCompte({ charges, paiements: [] }, midiQc("2026-11-05"));
  egal(c.enRetard, 1000, "en retard");
  assert.equal(c.depuis.toISOString().slice(0, 10), "2026-11-01", "retard compté depuis novembre, pas octobre");
});

test("Payé d'avance : crédit, rien en retard ni à recevoir", () => {
  const c = etatCompte({ charges: [loyer("2026-11-01")], paiements: [{ montant: 1500 }] }, midiQc("2026-11-10"));
  egal(c.solde, -500, "solde");
  egal(c.enRetard, 0, "en retard");
  egal(c.aRecevoir, 0, "à recevoir");
});

test("Comptes additionnés (fiche d'un locataire)", () => {
  const a = etatCompte({ charges: [loyer("2026-11-01")], paiements: [] }, midiQc("2026-11-30"));
  const b = etatCompte({ charges: [loyer("2026-12-01", 500)], paiements: [] }, midiQc("2026-11-30"));
  const t = additionnerComptes([a, b, undefined]);
  egal(t.solde, 1500, "solde");
  egal(t.enRetard, 1000, "en retard");
  egal(t.aRecevoir, 500, "à recevoir");
  assert.equal(t.tal, true);
});

// ---------- À faire ----------

const bail = (plus = {}) => ({ id: "b1", statut: "ACTIF", dateDebut: jour("2026-07-01"), dateFin: jour("2027-06-30"), loyer: 1000, nouveauLoyer: null, avisEnvoyeLe: null, reponseAvis: null, reponseAvisLe: null, ...plus });
const codes = (items) => items.map((i) => i.code).sort();

test("Bail de 12 mois : avis à envoyer du 1er janvier au 31 mars, rappel 15 jours avant la fin", () => {
  assert.deepEqual(codes(aSurveillerBail(bail(), null, midiQc("2026-12-20"))), []);
  const ouvert = aSurveillerBail(bail(), null, midiQc("2027-01-05"));
  assert.deepEqual(codes(ouvert), ["AVIS"]);
  assert.equal(ouvert[0].niveau, 1);
  const fin = aSurveillerBail(bail(), null, midiQc("2027-03-20"));
  assert.deepEqual(codes(fin), ["AVIS15"]);
  assert.equal(fin[0].niveau, 0);
  assert.notEqual(ouvert[0].cle, fin[0].cle, "deux avis distincts au propriétaire");
});

test("Avis sans réponse : réputé accepté passé le délai d'un mois (+ livraison)", () => {
  const b = bail({ avisEnvoyeLe: jour("2027-01-10"), nouveauLoyer: 1040 });
  assert.equal(finReponseAvis(b).toISOString().slice(0, 10), "2027-02-15");
  assert.deepEqual(codes(aSurveillerBail(b, null, midiQc("2027-02-14"))), []);
  assert.deepEqual(codes(aSurveillerBail(b, null, midiQc("2027-02-15"))), ["REPONSE"]);
  assert.deepEqual(codes(aSurveillerBail({ ...b, reponseAvis: "ACCEPTE" }, null, midiQc("2027-02-20"))), []);
});

test("Refus : un mois pour s'adresser au TAL, puis plus rien", () => {
  const b = bail({ avisEnvoyeLe: jour("2027-01-10"), nouveauLoyer: 1040, reponseAvis: "REFUSE", reponseAvisLe: jour("2027-01-25") });
  assert.deepEqual(codes(aSurveillerBail(b, null, midiQc("2027-02-20"))), ["REFUS"]);
  assert.deepEqual(codes(aSurveillerBail(b, null, midiQc("2027-02-26"))), []);
});

test("Fin du bail : renouveler dans les 30 jours, échu ensuite ; départ annoncé à part", () => {
  assert.deepEqual(codes(aSurveillerBail(bail(), null, midiQc("2027-06-10"))), ["RENOUVELER"]);
  assert.deepEqual(codes(aSurveillerBail(bail(), null, midiQc("2027-07-03"))), ["ECHU"]);
  const quitte = aSurveillerBail(bail({ avisEnvoyeLe: jour("2027-01-10"), reponseAvis: "QUITTE" }), null, midiQc("2027-06-10"));
  assert.deepEqual(codes(quitte), ["QUITTE"]);
  assert.equal(quitte[0].aviser, false);
});

test("Retard de plus de trois semaines : dans « À faire », urgent", () => {
  const compte = etatCompte({ charges: [loyer("2026-11-01")], paiements: [] }, midiQc("2026-11-24"));
  const items = aSurveillerBail(bail(), compte, midiQc("2026-11-24"));
  assert.deepEqual(codes(items), ["TAL"]);
  assert.equal(items[0].niveau, 0);
  assert.match(items[0].cle, /:TAL:2026-11-01$/);
});

test("Bail terminé : rien à surveiller", () => {
  assert.deepEqual(aSurveillerBail(bail({ statut: "TERMINE" }), null, midiQc("2027-07-03")), []);
});

// ---------- Hausse de loyer (méthode du TAL depuis 2026) ----------

test("Période du TAL : du 2 avril au 1er avril suivant", () => {
  assert.equal(periodeTal(jour("2026-04-01")), 2025);
  assert.equal(periodeTal(jour("2026-04-02")), 2026);
  assert.equal(periodeTal(jour("2027-04-01")), 2026);
  assert.equal(periodeTal(jour("2027-07-01")), 2027);
});

test("Pourcentage de base : publié par le TAL, sinon celui inscrit dans l'appli", () => {
  assert.deepEqual(pourcentageBase(2026), { taux: 3.1, officiel: true });
  assert.deepEqual(pourcentageBase(2026, { 2026: 9 }), { taux: 3.1, officiel: true }, "le taux publié a priorité");
  assert.equal(pourcentageBase(2027), null);
  assert.deepEqual(pourcentageBase(2027, { 2027: "2.8" }), { taux: 2.8, officiel: false });
});

test("Taxes et assurances : seule la part de la hausse au-delà du pourcentage de base", () => {
  egal(excedentHausse(10000, 10800, 3.1), 490, "10 000 → 10 800 $ à 3,1 %"); // 800 − 310
  egal(excedentHausse(10000, 10200, 3.1), 0, "hausse sous le taux de base");
  egal(excedentHausse(10000, 9000, 3.1), 0, "baisse");
  egal(excedentHausse("", 9000, 3.1), 0, "année précédente inconnue");
});

test("Calcul complet d'un logement", () => {
  const c = calculHausseTal({
    loyer: 1000, taux: 3.1, part: 0.25, logementId: "L1",
    taxes: { avant: 10000, apres: 10800 }, // excédent 490 $ → 490 × 0,25 / 12 = 10,21
    assurances: { avant: 4000, apres: 4400 }, // excédent 400 − 124 = 276 $ → 5,75
    travaux: [
      { montant: 24000, aide: 4000, logementId: null }, // immeuble : 20 000 × 0,25 = 5 000
      { montant: 6000, aide: 0, logementId: "L1" }, // ce logement : 6 000
      { montant: 9000, aide: 0, logementId: "L2" }, // un autre logement : ne compte pas
    ], // 11 000 × 5 % / 12 = 45,83
  });
  egal(c.base, 31, "base");
  egal(c.taxes, 10.21, "taxes");
  egal(c.assurances, 5.75, "assurances");
  egal(c.travaux, 45.83, "travaux");
  egal(c.hausse, 92.79, "hausse");
  egal(c.nouveauLoyer, 1092.79, "nouveau loyer");
  egal(c.pourcentage, 9.28, "pourcentage");
});

test("Part de chaque logement : loyer en cours, sinon loyer demandé du vacant", () => {
  const bail = (id, loyer) => ({ id, statut: "ACTIF", dateDebut: jour("2026-07-01"), dateFin: jour("2027-06-30"), loyer });
  const logements = [
    { id: "A", type: "LOGEMENT", baux: [bail("bA", 1000)] },
    { id: "B", type: "LOGEMENT", baux: [], loyerVise: 1000 },
    { id: "C", type: "COMMERCIAL", baux: [bail("bC", 2000)] },
    { id: "D", type: "LOGEMENT", baux: [] },
  ];
  const r = loyersImmeuble(logements);
  egal(r.total, 4000, "total");
  assert.deepEqual(r.sansLoyer.map((l) => l.id), ["D"]);
  const h = haussesImmeuble({ logements }, { taux: {}, taxes: {}, assurances: {}, travaux: [] }, midiQc("2026-11-24"));
  assert.equal(h.length, 1, "seuls les baux résidentiels en cours");
  egal(h[0].part, 0.25, "part du logement A");
  assert.equal(h[0].periode, 2027, "bail qui recommence le 1er juillet 2027");
  assert.equal(h[0].calcul, null, "taux 2027 pas encore publié");
  const h2 = haussesImmeuble({ logements }, { taux: { 2027: 3 }, taxes: {}, assurances: {}, travaux: [] }, midiQc("2026-11-24"));
  egal(h2[0].calcul.nouveauLoyer, 1030, "avec un taux inscrit");
});

test("Bail à durée indéterminée : hausse le 1er du mois dans deux mois", () => {
  assert.equal(debutHausse({ dateFin: null }, midiQc("2026-11-24")).toISOString().slice(0, 10), "2027-01-01");
});

// ---------- Revenus de location pour l'impôt ----------

test("Catégories de dépenses → lignes du T776", () => {
  assert.equal(ligneT776("TAXES_MUNICIPALES"), "9180");
  assert.equal(ligneT776("TAXES_SCOLAIRES"), "9180");
  assert.equal(ligneT776("ASSURANCE"), "8690");
  assert.equal(ligneT776("INTERETS"), "8710");
  assert.equal(ligneT776("DENEIGEMENT"), "8960");
  assert.equal(ligneT776("CHAUFFAGE"), "9220");
  assert.equal(ligneT776("IMMOBILISATION"), null, "immobilisation : pas déductible");
  assert.equal(ligneT776("INCONNUE"), "9270");
});

test("État annuel d'un immeuble : revenus, dépenses par ligne, immobilisations à part", () => {
  const { immeubles, total } = etatRevenusLocation({
    immeubles: [{ id: "I1", nom: "Triplex", unites: 3 }, { id: "I2", nom: "Duplex", unites: 2 }],
    charges: [
      { immeubleId: "I1", type: "LOYER", montant: 12000 },
      { immeubleId: "I1", type: "LOYER", montant: -500 }, // loyer remis
      { immeubleId: "I1", type: "FRAIS", montant: 25 }, // chèque sans provision
      { immeubleId: "I2", type: "LOYER", montant: 8000 },
    ],
    paiements: [{ immeubleId: "I1", montant: 11000 }],
    depenses: [
      { immeubleId: "I1", categorie: "TAXES_MUNICIPALES", montant: 3000 },
      { immeubleId: "I1", categorie: "TAXES_SCOLAIRES", montant: 300 },
      { immeubleId: "I1", categorie: "IMMOBILISATION", montant: 9000, description: "Fenêtres", date: jour("2026-05-01") },
      { immeubleId: "I2", categorie: "ASSURANCE", montant: 1200 },
    ],
    reparations: [
      { immeubleId: "I1", coutReel: 400, immobilisation: false, numero: "RP-1", titre: "Robinet", date: jour("2026-03-01") },
      { immeubleId: "I1", coutReel: 1700, immobilisation: true, numero: "RP-2", titre: "Chauffe-eau", date: jour("2026-02-01") },
      { immeubleId: "I1", coutReel: null, immobilisation: false, numero: "RP-3", titre: "Sans coût" },
    ],
  });
  const t = immeubles[0];
  egal(t.revenus[8141], 11500, "loyers bruts");
  egal(t.revenus[8230], 25, "autres revenus");
  egal(t.percu, 11000, "perçu");
  egal(t.depenses.find((d) => d.ligne === "9180").montant, 3300, "impôts fonciers");
  egal(t.depenses.find((d) => d.ligne === "8960").montant, 400, "réparations courantes");
  egal(t.totalDepenses, 3700, "total des dépenses");
  egal(t.net, 7825, "revenu net"); // 11 525 − 3 700
  assert.deepEqual(t.immobilisations.map((x) => x.description), ["RP-2 — Chauffe-eau", "Fenêtres"], "immobilisations par date");
  egal(t.totalImmobilisations, 10700, "immobilisations");
  egal(total.revenus.total, 19525, "total des revenus");
  egal(total.totalDepenses, 4900, "total des dépenses");
  egal(total.net, 14625, "total net");
  assert.equal(total.immeuble.unites, 5);
});

// ---------- État des lieux numérique ----------

test("Grille de départ selon le nombre de pièces", () => {
  const noms = (l) => piecesParDefaut(l).map((p) => p.nom);
  assert.deepEqual(noms({ type: "LOGEMENT", pieces: "4 ½" }).filter((n) => /Chambre/.test(n)), ["Chambre 1", "Chambre 2"]);
  assert.deepEqual(noms({ type: "LOGEMENT", pieces: "3½" }).filter((n) => /Chambre/.test(n)), ["Chambre"]);
  assert.deepEqual(noms({ type: "LOGEMENT", pieces: "5 1/2" }).filter((n) => /Chambre/.test(n)), ["Chambre 1", "Chambre 2", "Chambre 3"]);
  assert.deepEqual(noms({ type: "LOGEMENT", pieces: "1 ½" }), ["Pièce principale", "Cuisinette", "Salle de bain"]);
  assert.deepEqual(noms({ type: "COMMERCIAL" }), ["Espace principal", "Rangement"]);
  const cles = piecesParDefaut({ type: "LOGEMENT", pieces: "4 ½" }).flatMap((p) => [p.cle, ...p.elements.map((e) => e.cle)]);
  assert.equal(new Set(cles).size, cles.length, "clés uniques");
});

test("Sortie : mêmes pièces que l'entrée, comparées point par point", () => {
  const entree = piecesParDefaut({ type: "LOGEMENT", pieces: "3 ½" });
  const cuisine = entree.find((p) => p.nom === "Cuisine");
  cuisine.elements.find((e) => e.nom === "Plancher").etat = "BON";
  cuisine.elements.find((e) => e.nom === "Murs").etat = "USURE";
  cuisine.elements.find((e) => e.nom === "Cuisinière").etat = "DOMMAGE";
  const sortie = piecesPourSortie(entree);
  assert.deepEqual(sortie.map((p) => p.nom), entree.map((p) => p.nom));
  assert.equal(avancement(sortie).notes, 0);
  const s = sortie.find((p) => p.nom === "Cuisine");
  const el = (n) => s.elements.find((e) => e.nom === n);
  el("Plancher").etat = "DOMMAGE"; el("Plancher").note = "Brûlure devant la cuisinière";
  el("Murs").etat = "USURE";
  el("Cuisinière").etat = "DOMMAGE"; // déjà endommagée à l'entrée
  const comp = comparerAEntree(entree, sortie);
  assert.equal(comp[el("Plancher").cle].etat, "BON");
  assert.equal(comp[el("Plancher").cle].pire, true);
  assert.equal(comp[el("Murs").cle].pire, false);
  assert.equal(comp[el("Cuisinière").cle].pire, false);
  assert.deepEqual(dommagesDepuisEntree(entree, sortie), [{ piece: "Cuisine", element: "Plancher", avant: "BON", apres: "DOMMAGE", note: "Brûlure devant la cuisinière" }]);
});

test("Pièces reçues du navigateur : nettoyées", () => {
  assert.ok(normaliserPieces("x").erreur);
  assert.ok(normaliserPieces([{ nom: " " }]).erreur);
  const { pieces } = normaliserPieces([{ cle: "abcd1234", nom: "Salon", elements: [{ cle: "<script>", nom: "Murs", etat: "PIRE", note: "x".repeat(2000) }, { nom: "" }] }]);
  assert.equal(pieces[0].cle, "abcd1234");
  assert.equal(pieces[0].elements.length, 1);
  assert.notEqual(pieces[0].elements[0].cle, "<script>");
  assert.equal(pieces[0].elements[0].etat, null);
  assert.equal(pieces[0].elements[0].note.length, 1000);
});

console.log(`\n${reussis} test${reussis > 1 ? "s" : ""} réussi${reussis > 1 ? "s" : ""}${process.exitCode ? " — des tests ont échoué" : ""}.`);
