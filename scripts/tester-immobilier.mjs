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
} = await import("../lib/immobilierCalculs.js");

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

console.log(`\n${reussis} test${reussis > 1 ? "s" : ""} réussi${reussis > 1 ? "s" : ""}${process.exitCode ? " — des tests ont échoué" : ""}.`);
