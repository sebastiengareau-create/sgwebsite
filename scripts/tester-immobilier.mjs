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
const { etatCompte, etatRetard, additionnerComptes, aSurveillerBail, finReponseAvis, JOURS_RETARD_TAL } = await import("../lib/immobilierCalculs.js");

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

console.log(`\n${reussis} test${reussis > 1 ? "s" : ""} réussi${reussis > 1 ? "s" : ""}${process.exitCode ? " — des tests ont échoué" : ""}.`);
