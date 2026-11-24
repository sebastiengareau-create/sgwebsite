// Vérifie les calculs de l'entreposage de pneus (lib/pneusCalculs.js) :
// détail pneu par pneu, code DOT et âge, état du jeu, conseils de pose, plan
// de l'entrepôt et places libres, avancement de la saison, jeux oubliés.
//
//   node scripts/tester-pneus.mjs
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
  normaliserJeu, normaliserPneus, pneusDuJeu, appliquerUsures, positionsPour, lireDot, ageDot, evaluerJeu, conseilsPose,
  normaliserSeuils, SEUILS_PNEUS_DEFAUT, normaliserPlan, emplacementsRangee, cleEmplacement, canoniserEmplacement, occupationPlan,
  placesLibres, progressionSaison, estOublie, saisonAVenir, resumeEquipement,
} = await import("../lib/pneusCalculs.js");

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis += 1; console.log(`✓ ${nom}`); } catch (e) { console.error(`✗ ${nom}\n  ${e.message}`); process.exitCode = 1; }
}
const NOV_2026 = new Date("2026-11-24T17:00:00Z");
const jeu = (x) => ({ saison: "HIVER", quantite: 4, statut: "ENTREPOSE", ...x });

test("Positions selon la quantité", () => {
  assert.deepEqual(positionsPour(4), ["AVG", "AVD", "ARG", "ARD"]);
  assert.deepEqual(positionsPour(5).at(-1), "SECOURS");
  assert.equal(positionsPour(6).length, 6);
  assert.deepEqual(positionsPour(2), ["P1", "P2"]);
});

test("Code DOT : semaine et année, âge en années complètes", () => {
  assert.deepEqual(lireDot("2321", NOV_2026), { code: "2321", semaine: 23, annee: 2021 });
  assert.deepEqual(lireDot(" DOT 0518 ", NOV_2026), { code: "0518", semaine: 5, annee: 2018 });
  assert.equal(lireDot("", NOV_2026), null);
  assert.ok(Number.isNaN(lireDot("5821", NOV_2026)), "semaine 58");
  assert.ok(Number.isNaN(lireDot("0135", NOV_2026)), "année 2035 : pas encore fabriqué");
  assert.ok(Number.isNaN(lireDot("123", NOV_2026)), "3 chiffres");
  assert.equal(ageDot("2321", NOV_2026), 5);
  assert.equal(ageDot("5016", NOV_2026), 9, "fin 2016 : pas encore 10 ans en novembre 2026");
  assert.equal(ageDot("0116", NOV_2026), 10);
});

test("Détail pneu par pneu : usure du jeu et plus vieux pneu", () => {
  const { data, erreur } = normaliserJeu({
    saison: "HIVER", quantite: "4", jantes: "ACIER",
    pneus: [
      { position: "AVG", usure: "7", dot: "2321" }, { position: "AVD", usure: "7,5", dot: "2321" },
      { position: "ARG", usure: "6/32", dot: "1819" }, { position: "ARD", usure: "", dot: "" },
    ],
  }, { maintenant: NOV_2026 });
  assert.equal(erreur, undefined);
  assert.equal(data.usure, "7, 7,5, 6");
  assert.equal(data.anneeFabrication, 2019);
  assert.equal(data.pneus[2].usure, 6);
  assert.equal(data.pneus[3].dot, null);
});

test("Détail vide : rien d'enregistré ; erreurs lisibles", () => {
  assert.deepEqual(normaliserPneus([{ position: "AVG" }, { position: "AVD", usure: " " }]), { pneus: null });
  assert.match(normaliserPneus([{ position: "AVG", usure: "abc" }]).erreur, /avant gauche/);
  assert.match(normaliserPneus([{ position: "ARD", dot: "99" }]).erreur, /DOT du pneu arrière droit/);
  assert.match(normaliserPneus([{ position: "AVG", usure: "25" }]).erreur, /de 0 à 20/);
});

test("Équipement : clé antivol, capteurs, couple et pression", () => {
  const { data } = normaliserJeu({ saison: "ETE", antivol: "AVEC_JEU", capteurs: true, enjoliveurs: "false", couple: "100", pression: "" });
  assert.equal(data.antivol, "AVEC_JEU");
  assert.equal(data.capteurs, true);
  assert.equal(data.enjoliveurs, false);
  assert.equal(data.couple, 100);
  assert.equal(data.pression, null);
  assert.match(normaliserJeu({ saison: "ETE", couple: "5" }).erreur, /Couple/);
  assert.match(normaliserJeu({ saison: "ETE", antivol: "POCHE" }).erreur, /antivol/);
  assert.deepEqual(resumeEquipement(data), ["Clé antivol rangée avec le jeu", "Capteurs de pression (TPMS)", "Serrage à 100 lb-pi"]);
});

test("Modification partielle : seuls les champs reçus", () => {
  const { data } = normaliserJeu({ marque: " Michelin " }, { partiel: true });
  assert.deepEqual(data, { marque: "Michelin" });
});

test("Jeu inscrit avant le détail : l'usure du texte dans l'ordre des positions", () => {
  const d = pneusDuJeu(jeu({ usure: "8, 8, 7, 7" }));
  assert.deepEqual(d.map((p) => [p.position, p.usure]), [["AVG", 8], ["AVD", 8], ["ARG", 7], ["ARD", 7]]);
});

test("Nouvelles mesures à l'entrée : vide = inchangée", () => {
  const r = appliquerUsures(jeu({ usure: "8, 8, 7, 7" }), ["6", "", "5,5", null]);
  assert.equal(r.usure, "6, 8, 5,5, 7");
  assert.equal(r.pneus[2].usure, 5.5);
});

test("État : bon, à surveiller, à remplacer (usure, âge, pneu endommagé)", () => {
  assert.equal(evaluerJeu(jeu({}), SEUILS_PNEUS_DEFAUT, NOV_2026).code, null, "rien de mesuré");
  assert.equal(evaluerJeu(jeu({ usure: "9, 9, 9, 9", anneeFabrication: 2024 }), SEUILS_PNEUS_DEFAUT, NOV_2026).code, "BON");
  const usure = evaluerJeu(jeu({ usure: "8, 8, 6, 6" }), SEUILS_PNEUS_DEFAUT, NOV_2026);
  assert.equal(usure.code, "SURVEILLER");
  assert.equal(usure.usureMin, 6);
  const use = evaluerJeu(jeu({ usure: "4, 4, 7, 7" }), SEUILS_PNEUS_DEFAUT, NOV_2026);
  assert.equal(use.code, "REMPLACER");
  assert.match(use.raisons[0], /4\/32 po/);
  const vieux = evaluerJeu(jeu({ pneus: [{ position: "AVG", usure: 9, dot: "0115" }] }), SEUILS_PNEUS_DEFAUT, NOV_2026);
  assert.equal(vieux.code, "REMPLACER");
  assert.equal(vieux.age, 11);
  assert.equal(evaluerJeu(jeu({ anneeFabrication: 2019 }), SEUILS_PNEUS_DEFAUT, NOV_2026).code, "SURVEILLER", "7 ans");
  const hernie = evaluerJeu(jeu({ pneus: [{ position: "ARD", usure: 9, remplacer: true, note: "Hernie sur le flanc" }] }), SEUILS_PNEUS_DEFAUT, NOV_2026);
  assert.equal(hernie.code, "REMPLACER");
  assert.ok(hernie.raisons.includes("Arrière droit : Hernie sur le flanc"));
});

test("Seuils réglables, vérifiés", () => {
  assert.deepEqual(normaliserSeuils({ usureRemplacer: "3", usureSurveiller: "5,5" }).seuils, { ...SEUILS_PNEUS_DEFAUT, usureRemplacer: 3, usureSurveiller: 5.5 });
  assert.ok(normaliserSeuils({ usureRemplacer: "6", usureSurveiller: "4" }).erreur);
  assert.ok(normaliserSeuils({ ageSurveiller: "12" }).erreur, "12 ans à surveiller > 10 ans à remplacer");
  assert.equal(evaluerJeu(jeu({ usure: "5, 5, 5, 5" }), normaliserSeuils({ usureRemplacer: "5" }).seuils, NOV_2026).code, "REMPLACER");
});

test("Conseils de pose : permutation et alignement", () => {
  const c = conseilsPose(pneusDuJeu(jeu({ usure: "5, 5, 8, 8" })));
  assert.equal(c.length, 1);
  assert.match(c[0], /permutation/);
  const a = conseilsPose(pneusDuJeu(jeu({ usure: "4, 7, 7, 7" })));
  assert.ok(a.some((x) => /alignement/.test(x) && /l'avant/.test(x)));
  assert.deepEqual(conseilsPose(pneusDuJeu(jeu({ usure: "7, 7, 6, 6" }))), []);
});

test("Plan : rangées vérifiées, places nommées A-01…", () => {
  const { plan } = normaliserPlan({ rangees: [{ code: " a ", nom: "Mezzanine", places: "12" }, { code: "", nom: "", places: "" }, { code: "B", places: 120 }] });
  assert.equal(plan.rangees.length, 2);
  assert.equal(plan.rangees[0].code, "A");
  assert.deepEqual(emplacementsRangee(plan.rangees[0]).slice(0, 2), ["A-01", "A-02"]);
  assert.equal(emplacementsRangee(plan.rangees[1])[0], "B-001");
  assert.ok(normaliserPlan({ rangees: [{ code: "A", places: 4 }, { code: "a", places: 2 }] }).erreur, "code en double");
  assert.ok(normaliserPlan({ rangees: [{ code: "A", places: 0 }] }).erreur);
});

test("Emplacements : « a4 », « A04 » et « A-004 » sont la même place", () => {
  assert.equal(cleEmplacement("a4"), "A-4");
  assert.equal(cleEmplacement("A04"), "A-4");
  assert.equal(cleEmplacement("A-004"), "A-4");
  assert.equal(cleEmplacement("MEZZ 2-03"), "MEZZ-2-3");
  const plan = { rangees: [{ code: "A", places: 12 }] };
  assert.equal(canoniserEmplacement("a4", plan), "A-04");
  assert.equal(canoniserEmplacement("cage 2", plan), "CAGE 2", "hors plan : gardé tel quel");
});

test("Occupation du plan et places libres", () => {
  const plan = { rangees: [{ code: "A", places: 4 }, { code: "B", places: 2 }] };
  const jeux = [{ id: 1, emplacement: "A-01" }, { id: 2, emplacement: "a3" }, { id: 3, emplacement: "SOUS-SOL" }];
  const o = occupationPlan(plan, jeux);
  assert.equal(o.total, 6);
  assert.equal(o.occupees, 2);
  assert.equal(o.libres, 4);
  assert.deepEqual(o.horsPlan.map((j) => j.id), [3]);
  assert.equal(o.rangees[0].cases[2].jeux[0].id, 2);
  assert.deepEqual(placesLibres(plan, jeux.map((j) => j.emplacement), 3), ["A-02", "A-04", "B-01"]);
});

test("Avancement de la saison et jeux oubliés", () => {
  const aVenir = saisonAVenir(NOV_2026);
  assert.equal(aVenir.saison, "HIVER");
  const jeux = [
    jeu({ statut: "POSE", mouvements: [{ type: "SORTIE", date: "2026-11-10T15:00:00Z" }] }),
    jeu({ statut: "POSE", mouvements: [{ type: "SORTIE", date: "2025-11-10T15:00:00Z" }] }), // l'an dernier
    jeu({ statut: "ENTREPOSE", mouvements: [{ type: "ENTREE", date: "2026-04-20T15:00:00Z" }] }),
    jeu({ saison: "ETE", statut: "ENTREPOSE", mouvements: [{ type: "ENTREE", date: "2026-11-10T15:00:00Z" }] }),
  ];
  assert.deepEqual(progressionSaison(jeux, aVenir), { faits: 1, restants: 1, total: 2 });
  assert.equal(estOublie(jeu({ mouvements: [{ type: "ENTREE", date: "2025-10-01T15:00:00Z" }] }), NOV_2026), true);
  assert.equal(estOublie(jeu({ mouvements: [{ type: "ENTREE", date: "2026-04-20T15:00:00Z" }] }), NOV_2026), false);
  assert.equal(estOublie(jeu({ statut: "POSE", mouvements: [{ type: "SORTIE", date: "2024-01-01T15:00:00Z" }] }), NOV_2026), false);
});

console.log(`\n${reussis} test${reussis > 1 ? "s" : ""} réussi${reussis > 1 ? "s" : ""}.`);
