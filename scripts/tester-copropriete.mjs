// Vérifie les calculs de la Copropriété reliée à la comptabilité et de sa
// rue illustrée : répartition d'une cotisation entre les fonds selon le
// budget (lib/coproprieteCompta.js), état de chaque unité et bâtiments mis
// en immeubles (lib/coproprieteVisuel.js).
//
//   node scripts/tester-copropriete.mjs
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
const { partsCotisation } = await import("../lib/coproprieteCompta.js");
const { etatUnite, batimentsPourRue, CONSEILS_MOIS_COPRO } = await import("../lib/coproprieteVisuel.js");
const { rangeesImmeuble } = await import("../lib/immobilierVisuel.js");
const { groupesRepartition, budgetDuGroupe, seulGroupe, repartitionBudget } = await import("../lib/coproprieteCalculs.js");

let reussis = 0;
function test(nom, fn) {
  try {
    fn();
    reussis += 1;
    console.log(`✓ ${nom}`);
  } catch (e) {
    console.error(`✗ ${nom}\n  ${e.message}`);
    process.exitCode = 1;
  }
}

const BUDGET = { chargesCourantes: 62400, fondsPrevoyance: 9600, fondsAutoAssurance: 2400 };

test("Cotisation répartie entre les fonds selon le budget", () => {
  assert.deepEqual(partsCotisation(620, BUDGET), { exploitation: 520, prevoyance: 80, autoAssurance: 20 });
  assert.deepEqual(partsCotisation(-620, BUDGET), { exploitation: -520, prevoyance: -80, autoAssurance: -20 }, "un crédit fait l'inverse");
  assert.deepEqual(partsCotisation(100, null), { exploitation: 100, prevoyance: 0, autoAssurance: 0 }, "sans budget : tout à l'exploitation");
  for (const m of [333.33, 1, 0.07, 4521.89]) {
    const p = partsCotisation(m, { chargesCourantes: 10000, fondsPrevoyance: 1000, fondsAutoAssurance: 333 });
    assert.equal(Math.round((p.exploitation + p.prevoyance + p.autoAssurance) * 100) / 100, m, `la somme fait toujours ${m}`);
  }
});

test("État d'une unité dans la rue illustrée", () => {
  assert.equal(etatUnite({ solde: 0 }), "OK");
  assert.equal(etatUnite({ solde: 620, duCeMois: 620 }), "OK", "la cotisation du mois n'est pas encore en retard");
  assert.equal(etatUnite({ solde: 1240, duCeMois: 620 }), "RETARD", "le mois d'avant est impayé");
  assert.equal(etatUnite({ solde: 0, demandes: 1 }), "SURVEILLER");
  assert.equal(etatUnite({ solde: 0, proprietaires: 0 }), "SANS");
  assert.equal(CONSEILS_MOIS_COPRO.length, 12, "un conseil par mois");
});

test("Bâtiments mis en immeubles « condo » pour la rue", () => {
  const unites = [
    { id: "a", numero: "101", type: "LOGEMENT", etage: "1", batimentId: "b1" },
    { id: "b", numero: "201", type: "LOGEMENT", etage: "2", batimentId: "b1" },
    { id: "c", numero: "P-1", type: "STATIONNEMENT", batimentId: "b1" },
    { id: "d", numero: "301", type: "LOGEMENT", batimentId: null },
  ];
  const rue = batimentsPourRue([{ id: "b1", nom: "Phase 1" }], unites);
  assert.deepEqual(rue.map((b) => [b.nom, b.type, b.logements.length]), [["Phase 1", "CONDO", 3], ["Autres unités", "CONDO", 1]]);
  assert.equal(batimentsPourRue([], unites)[0].nom, "La copropriété", "sans bâtiment : un seul immeuble");
  const douze = rangeesImmeuble({ type: "CONDO", logements: Array.from({ length: 12 }, (_, i) => ({ id: String(i), numero: String(101 + i), type: "LOGEMENT" })) });
  assert.deepEqual(douze.rangees.map((r) => r.length), [4, 4, 4], "condo : plusieurs unités par étage");
});

test("Quotes-parts à 100 % par bâtiment, un budget par bâtiment", () => {
  const batiments = [{ id: "A", nom: "Bâtiment A" }, { id: "B", nom: "Bâtiment B" }];
  const unites = [
    { id: "a1", numero: "101", quotePart: 60, batimentId: "A" }, { id: "a2", numero: "102", quotePart: 40, batimentId: "A" },
    { id: "b1", numero: "101", quotePart: 50, batimentId: "B" }, { id: "b2", numero: "102", quotePart: 50, batimentId: "B" },
  ];
  const groupes = groupesRepartition(unites, batiments);
  assert.deepEqual(groupes.map((g) => [g.nom, g.unites.length]), [["Bâtiment A", 2], ["Bâtiment B", 2]]);
  const budgets = [
    { id: "ga", batimentId: "A", annee: 2026, moisDebut: 1, chargesCourantes: 12000 },
    { id: "gb", batimentId: "B", annee: 2026, moisDebut: 1, chargesCourantes: 24000 },
    { id: "gc", batimentId: null, annee: 2026, moisDebut: 1, chargesCourantes: 99999 },
  ];
  const seul = seulGroupe(unites);
  assert.equal(seul, false);
  assert.equal(budgetDuGroupe(budgets, "2026-11", "A", seul).id, "ga");
  assert.equal(budgetDuGroupe(budgets, "2026-11", "B", seul).id, "gb");
  assert.equal(budgetDuGroupe(budgets, "2027-01", "A", seul), null, "aucun budget pour l'exercice suivant");
  assert.equal(budgetDuGroupe(budgets.filter((b) => b.id !== "gb"), "2026-11", "B", seul), null, "un bâtiment sans budget ne prend pas celui de la copropriété");
  // Chaque bâtiment se répartit son propre budget, à 100 %
  const mensuel = Object.fromEntries(groupes.flatMap((g) => repartitionBudget(budgetDuGroupe(budgets, "2026-11", g.batimentId, seul), g.unites).lignes.map((l) => [l.uniteId, l.mensuel])));
  assert.deepEqual(mensuel, { a1: 600, a2: 400, b1: 1000, b2: 1000 });
  assert.equal(repartitionBudget(budgets[0], groupes[0].unites).ecartQp, false, "100 % dans le bâtiment A");
  // Immeuble seul : le budget de la copropriété entière sert toujours
  const seules = unites.filter((u) => u.batimentId === "A");
  assert.equal(budgetDuGroupe([budgets[2]], "2026-11", "A", seulGroupe(seules)).id, "gc");
  assert.equal(budgetDuGroupe(budgets, "2026-11", "A", seulGroupe(seules)).id, "ga", "son propre budget passe d'abord");
  assert.equal(budgetDuGroupe(budgets, "2026-11", null, true).id, "gc", "sans bâtiment : le budget de la copropriété");
});

console.log(`\n${reussis} test${reussis > 1 ? "s" : ""} réussi${reussis > 1 ? "s" : ""}${process.exitCode ? " — des tests ont échoué" : ""}.`);
