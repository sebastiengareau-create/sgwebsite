// Vérifie le moteur de paie (lib/paie.js) contre les exemples chiffrés du
// guide TP-1015.F (2026-01) de Revenu Québec, annexes 1 à 3.
//
//   node scripts/tester-paie.js
//
// Aucune base de données n'est lue : seule la fonction de calcul est testée.
process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
const assert = require("node:assert/strict");
const { calculerPaie } = require("../lib/paie");

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
const egal = (obtenu, attendu, quoi) => assert.ok(Math.abs(obtenu - attendu) < 0.005, `${quoi} : obtenu ${obtenu}, attendu ${attendu}`);

// ---- Annexe 3 : cotisations au RRQ, 4 000 $ aux deux semaines ----
test("Annexe 3 — RRQ d'une paie ordinaire : 243,52 $", () => {
  const r = calculerPaie(4000, "BIHEBDOMADAIRE", {}, 2026);
  egal(r.rrqEmploye, 243.52, "C");
  egal(r.rrq2Employe, 0, "C2");
});
test("Annexe 3 — 19e paie : C = 95,94 $ et C2 = 56 $", () => {
  const r = calculerPaie(4000, "BIHEBDOMADAIRE", { rrq: 4383.36, gains: 72000 }, 2026);
  egal(r.rrqEmploye, 95.94, "C");
  egal(r.rrq2Employe, 56, "C2");
  egal(r.rrqEmployeur, 95.94, "C employeur");
});
test("Annexe 3 — 20e paie : C = 0 $ et C2 = 160 $", () => {
  const r = calculerPaie(4000, "BIHEBDOMADAIRE", { rrq: 4479.30, rrq2: 56, gains: 76000 }, 2026);
  egal(r.rrqEmploye, 0, "C");
  egal(r.rrq2Employe, 160, "C2");
});
test("Annexe 3 — 22e paie : C2 limitée au solde du maximum (40 $)", () => {
  const r = calculerPaie(4000, "BIHEBDOMADAIRE", { rrq: 4479.30, rrq2: 376, gains: 84000 }, 2026);
  egal(r.rrq2Employe, 40, "C2");
});

// ---- Annexe 1 : impôt du Québec sur paiements réguliers ----
// 4 000 $ aux deux semaines, 200 $ de RPA par paie, 21 830 $ au TP-1015.3.
const annexe1 = { deductionsPeriode: 200, montantTp10153: 21830 };
test("Annexe 1 — 18 premières paies : H, CSA et revenu imposable annuel", () => {
  const r = calculerPaie(4000, "BIHEBDOMADAIRE", {}, 2026, annexe1);
  egal(r.detail.H, 55.77, "H");
  egal(r.detail.CSA, 38.65, "CSA");
  egal(r.detail.revenuQcRegulier, 96345.08, "I");
  // Le guide retient 444,51 $ avec des achats d'actions de fonds de travailleurs
  // (975 $ de crédits par année) ; sans ces achats : (11 557,37 $ + 975 $) ÷ 26
  egal(r.impotQuebec, 482.01, "A sans fonds de travailleurs");
});
test("Annexe 1 — 22e paie : 481,76 $", () => {
  const r = calculerPaie(4000, "BIHEBDOMADAIRE", { rrq: 4479.30, rrq2: 376, gains: 84000 }, 2026, annexe1);
  egal(r.detail.CSA, 40, "CSA");
  egal(r.detail.revenuQcRegulier, 96309.98, "I");
  egal(r.impotQuebec, 481.76, "A");
});
test("Annexe 1 — 4 dernières paies : 489,36 $", () => {
  const r = calculerPaie(4000, "BIHEBDOMADAIRE", { rrq: 4479.30, rrq2: 416, gains: 88000 }, 2026, annexe1);
  egal(r.detail.CSA, 0, "CSA");
  egal(r.detail.revenuQcRegulier, 97349.98, "I");
  egal(r.impotQuebec, 489.36, "A");
});

// ---- Annexe 2 : paiement rétroactif (seconde méthode) ----
// 1 500 $ par semaine, 100 $ de RPA ; à la 20e paie, 4 000 $ de rétroactif
// et 400 $ de RPA de plus sur ce paiement.
test("Annexe 2 — rétroactif de 4 000 $ : 676,49 $ d'impôt du Québec", () => {
  const r = calculerPaie(5500, "HEBDOMADAIRE", {}, 2026, { boni: 4000, deductionsPeriode: 500, deductionsBoni: 400 });
  egal(r.detail.H, 27.88, "H");
  egal(r.detail.CSA, 14.82, "CSA");
  egal(r.detail.CSB, 39.51, "CSB");
  egal(r.detail.revenuQcRegulier, 70579.60, "P × (G – F – H – CSA)");
  egal(r.detail.impotQuebecBoni, 676.49, "A sur le rétroactif");
});

// ---- Règles ponctuelles du guide ----
test("Gratification, salaire annuel + forfaitaire ≤ 18 952 $ : retenue de 7 %", () => {
  const r = calculerPaie(1300, "HEBDOMADAIRE", {}, 2026, { boni: 1000 });
  egal(r.detail.impotQuebecBoni, 70, "7 % de 1 000 $");
});
test("Exemption du RRQ par période : deux décimales sans arrondir (67,30 $ par semaine)", () => {
  const r = calculerPaie(1000, "HEBDOMADAIRE", {}, 2026);
  egal(r.rrqEmploye, 58.76, "0,063 × (1 000 $ – 67,30 $)");
});
test("RQAP : maximums annuels de l'employé et de l'employeur", () => {
  const r = calculerPaie(5000, "BIHEBDOMADAIRE", { rqap: 440, rqapEmployeur: 615 }, 2026);
  egal(r.rqapEmploye, 2.90, "employé");
  egal(r.rqapEmployeur, 5.06, "employeur");
});

// ---- Cohérence de l'impôt fédéral (pas d'exemple chiffré dans le guide fourni) ----
test("Fédéral — un boni est imposé au taux marginal, pas annualisé", () => {
  const sans = calculerPaie(2000, "BIHEBDOMADAIRE", {}, 2026);
  const avec = calculerPaie(3000, "BIHEBDOMADAIRE", {}, 2026, { boni: 1000 });
  const surBoni = avec.impotFederal - sans.impotFederal;
  assert.ok(surBoni > 100 && surBoni < 125, `impôt fédéral sur 1 000 $ de boni à 52 000 $/an : ${surBoni.toFixed(2)} $ (attendu ≈ 14 % moins l'abattement)`);
});
test("Fédéral — aucun impôt sous le montant personnel de base", () => {
  const r = calculerPaie(500, "BIHEBDOMADAIRE", {}, 2026);
  egal(r.impotFederal, 0, "impôt fédéral");
  egal(r.impotQuebec, 0, "impôt du Québec");
});
test("Montants TD1 / TP-1015.3 plus élevés : moins d'impôt retenu", () => {
  const base = calculerPaie(2500, "BIHEBDOMADAIRE", {}, 2026);
  const plus = calculerPaie(2500, "BIHEBDOMADAIRE", {}, 2026, { montantTd1: 30000, montantTp10153: 30000 });
  assert.ok(plus.impotFederal < base.impotFederal && plus.impotQuebec < base.impotQuebec);
});

console.log(`\n${reussis} test(s) réussi(s)${process.exitCode ? " — des tests ont échoué" : ""}.`);
