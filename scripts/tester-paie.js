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

// ---- T4127 (122e édition) : exemple de calcul d'une prime régulière ----
// L'exemple du guide vise un employé hors Québec : on le rejoue avec une
// table aux taux du RPC et de l'AE hors Québec, sans RQAP ni abattement. La
// même logique sert aux employés du Québec, avec la table du Québec.
// 1 000 $ par semaine, prime de 2 500 $, 1 500 $ de primes déjà versées
// (dont 14,60 $ de cotisations supplémentaires au RPC déjà déduites).
const tableHorsQuebec = {
  RRQ: { exemptionGenerale: 3500, maxGainsAdmissibles: 74600, maxSupplementaire: 85000, tauxBase: 0.0595, tauxBaseSeul: 0.0495, tauxPremiereSupplementaire: 0.01, tauxSupplementaire2: 0.04, maxEmploye: 4230.45, maxEmployeSupplementaire2: 416 },
  RQAP: { maxAssurable: 0, tauxEmploye: 0, tauxEmployeur: 0, maxEmploye: 0, maxEmployeur: 0 },
  AE: { maxAssurable: 68900, tauxEmploye: 0.0163, tauxEmployeur: 0.02282, maxEmploye: 1123.07, maxEmployeur: 1572.30 },
  QC: {
    paliers: [{ jusqu_a: Infinity, taux: 0, constante: 0 }], tauxCredit: 0, montantBase: 0,
    deductionTravailleurTaux: 0, deductionTravailleurMax: 0, seuilGratification: 0, tauxGratificationSousSeuil: 0,
  },
  FED: {
    paliers: [
      { jusqu_a: 58523, taux: 0.14, constante: 0 },
      { jusqu_a: 117045, taux: 0.205, constante: 3804 },
      { jusqu_a: 181440, taux: 0.26, constante: 10241 },
      { jusqu_a: 258482, taux: 0.29, constante: 15685 },
      { jusqu_a: Infinity, taux: 0.33, constante: 26024 },
    ],
    tauxCredit: 0.14, montantBase: 16452, montantBaseMin: 14829, montantBaseSeuilReduction: 181440, montantBaseSeuilMin: 258482,
    montantEmploi: 1501, seuilPrimeFixe: 5000, tauxPrimeFixe: 0.15, abattementQuebec: 0,
  },
  anneeTaux: 2026, tauxAJour: true,
};
test("T4127 — exemple de prime régulière : 323,54 $ d'impôt fédéral sur la prime", () => {
  const r = calculerPaie(3500, "HEBDOMADAIRE", { rrq: 1700, ae: 480, gains: 30500, boni: 1500, csbBoni: 14.60 }, 2026, { boni: 2500, table: tableHorsQuebec });
  egal(r.rrqEmploye, 204.25, "C");
  egal(r.detail.CSA, 9.81, "F5A");
  egal(r.detail.CSB, 24.52, "F5B");
  egal(r.detail.impotFederalBoni, 323.54, "TB");
});
test("Fédéral, Québec — assurance-emploi à 1,30 %, maximum 895,70 $", () => {
  egal(calculerPaie(2000, "BIHEBDOMADAIRE", {}, 2026).aeEmploye, 26, "AE");
  egal(calculerPaie(2000, "BIHEBDOMADAIRE", { ae: 890 }, 2026).aeEmploye, 5.70, "AE au maximum");
});
test("Fédéral, Québec — prime avec un revenu annuel de 5 000 $ ou moins : 10 %", () => {
  const r = calculerPaie(560, "HEBDOMADAIRE", {}, 2026, { boni: 500 });
  egal(r.detail.impotFederalBoni, 50, "10 % de 500 $");
});

// ---- Cohérence de l'impôt fédéral ----
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
