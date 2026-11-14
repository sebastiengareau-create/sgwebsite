// Vérifie les calculs du pointage de quart (lib/quartsCalculs.js) et les
// heures de paie tirées de la présence (lib/heuresPaie.js).
//
//   node scripts/tester-quarts.js
//
// Aucune base de données n'est lue.
const assert = require("node:assert/strict");
const { calculerJours, arrondirInstant, totaliser } = require("../lib/quartsCalculs");
const { calculerHeuresPeriode } = require("../lib/heuresPaie");
const { dateHeureQuebecVersUTC } = require("../lib/temps");

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis += 1; console.log(`✓ ${nom}`); } catch (e) { console.error(`✗ ${nom}\n  ${e.message}`); process.exitCode = 1; }
}
const egal = (obtenu, attendu, quoi) => assert.ok(Math.abs(obtenu - attendu) < 0.006, `${quoi} : obtenu ${obtenu}, attendu ${attendu}`);
const h = (jour, heure) => dateHeureQuebecVersUTC(jour, heure);
const J = "2026-11-10"; // un mardi
const ouverture8 = (jour) => h(jour, "08:00");
const maintenant = h("2026-11-20", "12:00");
const quart = (debut, fin, plus = {}) => ({ id: debut, type: "TRAVAIL", debut: h(J, debut), fin: fin ? h(J, fin) : null, ...plus });
const coupure = (type, debut, fin) => ({ id: type + debut, type, debut: h(J, debut), fin: fin ? h(J, fin) : null });
const sansArrondi = { arrondiMinutes: 0, calerOuverture: false, dinerPaye: false };

test("Arrondi au quart d'heure : au plus proche, dans les deux sens", () => {
  assert.equal(arrondirInstant(h(J, "07:53"), 15), h(J, "08:00").getTime());
  assert.equal(arrondirInstant(h(J, "08:07"), 15), h(J, "08:00").getTime());
  assert.equal(arrondirInstant(h(J, "08:08"), 15), h(J, "08:15").getTime());
  assert.equal(arrondirInstant(h(J, "16:52"), 15), h(J, "16:45").getTime());
  assert.equal(arrondirInstant(h(J, "16:53"), 0), h(J, "16:53").getTime());
});

test("8 h présent, 6,5 h sur des bons : 81 % d'efficacité", () => {
  const jours = calculerJours({
    quarts: [quart("08:00", "16:30"), coupure("DINER", "12:00", "12:30")],
    entreesBons: [{ debut: h(J, "08:00"), fin: h(J, "12:00") }, { debut: h(J, "12:30"), fin: h(J, "15:00") }],
    entreesInternes: [{ debut: h(J, "15:00"), fin: h(J, "15:45") }],
    reglages: sansArrondi, maintenant,
  });
  const j = jours.get(J);
  egal(j.presence, 8.5, "présence"); egal(j.diner, 0.5, "dîner"); egal(j.payees, 8, "payées");
  egal(j.bons, 6.5, "bons"); egal(j.internes, 0.75, "internes"); egal(j.nonAttribue, 0.75, "non attribué");
  egal(j.efficacite, 0.8125, "efficacité");
  assert.equal(j.anomalies.length, 0);
});

test("Dîner payé : il n'est pas retranché", () => {
  const j = calculerJours({ quarts: [quart("08:00", "16:30"), coupure("DINER", "12:00", "12:30")], reglages: { ...sansArrondi, dinerPaye: true }, maintenant }).get(J);
  egal(j.payees, 8.5, "payées");
});

test("La pause est payée", () => {
  const j = calculerJours({ quarts: [quart("08:00", "16:00"), coupure("PAUSE", "10:00", "10:15")], reglages: sansArrondi, maintenant }).get(J);
  egal(j.payees, 8, "payées"); egal(j.pauses, 0.25, "pauses");
});

test("Deux chronos en même temps ne comptent pas en double", () => {
  const j = calculerJours({
    quarts: [quart("08:00", "12:00")],
    entreesBons: [{ debut: h(J, "08:00"), fin: h(J, "10:00") }, { debut: h(J, "09:00"), fin: h(J, "11:00") }],
    reglages: sansArrondi, maintenant,
  }).get(J);
  egal(j.bons, 3, "bons");
});

test("Arrondi : 7 h 53 à 16 h 38 avec dîner de 12 h 02 à 12 h 34 → 8 h à 16 h 45, moins 30 min", () => {
  const j = calculerJours({ quarts: [quart("07:53", "16:38"), coupure("DINER", "12:02", "12:34")], reglages: { arrondiMinutes: 15, calerOuverture: false, dinerPaye: false }, maintenant }).get(J);
  egal(j.payees, 8.25, "payées");
});

test("Arrivée avant l'ouverture : payé à partir de l'ouverture", () => {
  const j = calculerJours({ quarts: [quart("07:20", "16:00")], reglages: { arrondiMinutes: 15, calerOuverture: true, dinerPaye: true }, ouvertureDuJour: ouverture8, maintenant }).get(J);
  egal(j.payees, 8, "payées");
});

test("Arrivée avant l'ouverture, tâche commencée à 7 h 30 : payé à partir de 7 h 30", () => {
  const j = calculerJours({
    quarts: [quart("07:20", "16:00")], entreesBons: [{ debut: h(J, "07:31"), fin: h(J, "09:00") }],
    reglages: { arrondiMinutes: 15, calerOuverture: true, dinerPaye: true }, ouvertureDuJour: ouverture8, maintenant,
  }).get(J);
  egal(j.payees, 8.5, "payées");
});

test("Quart corrigé par le gérant : jamais calé sur l'ouverture", () => {
  const j = calculerJours({ quarts: [quart("07:00", "16:00", { modifiePar: "Gérant" })], reglages: { arrondiMinutes: 15, calerOuverture: true, dinerPaye: true }, ouvertureDuJour: ouverture8, maintenant }).get(J);
  egal(j.payees, 9, "payées");
});

test("Anomalies : départ oublié (bloquant), quart de plus de 12 h, chevauchement, tâche hors quart", () => {
  const oublie = calculerJours({ quarts: [quart("08:00", null)], reglages: sansArrondi, maintenant }).get(J);
  assert.deepEqual(oublie.anomalies.map((a) => [a.code, a.bloquante]), [["DEPART_OUBLIE", true]]);
  egal(oublie.payees, 0, "payées d'un quart oublié");

  const long = calculerJours({ quarts: [quart("06:00", "19:00")], reglages: sansArrondi, maintenant }).get(J);
  assert.deepEqual(long.anomalies.map((a) => a.code), ["QUART_LONG"]);

  const chevauche = calculerJours({ quarts: [quart("08:00", "12:00"), quart("11:00", "16:00")], reglages: sansArrondi, maintenant }).get(J);
  assert.ok(chevauche.anomalies.some((a) => a.code === "CHEVAUCHEMENT" && a.bloquante));

  const hors = calculerJours({ quarts: [quart("08:00", "12:00")], entreesBons: [{ debut: h(J, "13:00"), fin: h(J, "14:00") }], reglages: sansArrondi, maintenant }).get(J);
  assert.deepEqual(hors.anomalies.map((a) => a.code), ["TACHE_HORS_QUART"]);

  const ferme = calculerJours({ quarts: [quart("08:00", "16:00", { fermeAuto: true })], reglages: sansArrondi, maintenant }).get(J);
  assert.deepEqual(ferme.anomalies.map((a) => [a.code, a.bloquante]), [["FERME_AUTO", false]]);
});

test("Quart en cours aujourd'hui : compte jusqu'à maintenant, sans anomalie", () => {
  const j = calculerJours({ quarts: [quart("08:00", null)], reglages: sansArrondi, maintenant: h(J, "11:00") }).get(J);
  egal(j.payees, 3, "payées"); assert.equal(j.enCours, true); assert.equal(j.anomalies.length, 0);
});

test("Totaux d'une période", () => {
  const jours = calculerJours({ quarts: [quart("08:00", "16:00")], entreesBons: [{ debut: h(J, "08:00"), fin: h(J, "14:00") }], reglages: sansArrondi, maintenant });
  const t = totaliser([...jours.values()]);
  egal(t.payees, 8, "payées"); egal(t.efficacite, 0.75, "efficacité");
});

// ---- Paie selon la présence : heures supplémentaires à la semaine ----
const horaire = { lun: 8, mar: 8, mer: 8, jeu: 8, ven: 5, sam: 0, dim: 0 };
test("Présence : 4 jours de 10 h (40 h) → aucune heure supplémentaire, même à 10 h par jour", () => {
  const heuresPresence = new Map([["2026-11-09", 10], ["2026-11-10", 10], ["2026-11-11", 10], ["2026-11-12", 10]]);
  const r = calculerHeuresPeriode({ entrees: [], debutStr: "2026-11-08", finStr: "2026-11-14", horaire, horaireComplet: false, heuresPresence });
  egal(r.heuresRegulieres, 40, "régulières"); egal(r.heuresSupplementaires, 0, "supplémentaires");
});
test("Présence : 44,5 h une semaine, 32 h la suivante → 72 h régulières et 4,5 h supplémentaires", () => {
  const heuresPresence = new Map([
    ["2026-11-09", 9], ["2026-11-10", 9], ["2026-11-11", 9], ["2026-11-12", 9], ["2026-11-13", 8.5],
    ["2026-11-16", 8], ["2026-11-17", 8], ["2026-11-18", 8], ["2026-11-19", 8],
  ]);
  const r = calculerHeuresPeriode({ entrees: [], debutStr: "2026-11-08", finStr: "2026-11-21", horaire, horaireComplet: false, heuresPresence });
  egal(r.heuresRegulieres, 72, "régulières"); egal(r.heuresSupplementaires, 4.5, "supplémentaires");
});
test("Présence : payé pour la présence réelle, pas pour l'horaire d'ouverture", () => {
  const r = calculerHeuresPeriode({ entrees: [], debutStr: "2026-11-08", finStr: "2026-11-14", horaire, horaireComplet: false, heuresPresence: new Map([["2026-11-09", 6.25]]) });
  egal(r.heuresRegulieres, 6.25, "régulières");
});

console.log(`\n${reussis} tests réussis.`);
