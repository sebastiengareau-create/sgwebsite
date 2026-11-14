// Vérifie le moteur de paie (lib/paie.js) contre les exemples chiffrés du
// guide TP-1015.F (2026-01) de Revenu Québec, annexes 1 à 3.
//
//   node scripts/tester-paie.js
//
// Aucune base de données n'est lue : seule la fonction de calcul est testée.
process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
const assert = require("node:assert/strict");
const { calculerPaie } = require("../lib/paie");
const { calculerHeuresPeriode } = require("../lib/heuresPaie");
const { joursFeriesQuebec, joursFeriesEntre } = require("../lib/joursFeries");

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

// ---- Cotisations de l'employeur : FSS, normes du travail, CNESST ----
test("FSS — 1,65 % par défaut (TP-1015.F, partie 5), ou le taux réglé", () => {
  egal(calculerPaie(2000, "BIHEBDOMADAIRE", {}, 2026).fssEmployeur, 33, "1,65 % de 2 000 $");
  egal(calculerPaie(2000, "BIHEBDOMADAIRE", {}, 2026, { tauxFss: 1.25 }).fssEmployeur, 25, "1,25 % de 2 000 $");
  egal(calculerPaie(5000, "BIHEBDOMADAIRE", { gains: 200000 }, 2026).fssEmployeur, 82.5, "sans maximum annuel");
});
test("Normes du travail — 0,06 %, jusqu'au maximum annuel de 103 000 $", () => {
  egal(calculerPaie(2000, "BIHEBDOMADAIRE", {}, 2026).cntEmployeur, 1.2, "0,06 % de 2 000 $");
  egal(calculerPaie(5000, "BIHEBDOMADAIRE", { gains: 102000 }, 2026).cntEmployeur, 0.6, "sur les 1 000 $ restants");
  egal(calculerPaie(5000, "BIHEBDOMADAIRE", { gains: 110000 }, 2026).cntEmployeur, 0, "maximum atteint");
});
test("CNESST — taux de l'employeur par 100 $, jusqu'au maximum assurable ; rien sans taux", () => {
  egal(calculerPaie(2000, "BIHEBDOMADAIRE", {}, 2026).cnesstEmployeur, 0, "taux non réglé");
  egal(calculerPaie(2000, "BIHEBDOMADAIRE", {}, 2026, { tauxCnesst: 2.1 }).cnesstEmployeur, 42, "2,10 $ par 100 $");
  egal(calculerPaie(5000, "BIHEBDOMADAIRE", { gains: 102000 }, 2026, { tauxCnesst: 2.1 }).cnesstEmployeur, 21, "sur les 1 000 $ restants");
});
test("Les cotisations de l'employeur ne changent pas le net de l'employé", () => {
  const sans = calculerPaie(2000, "BIHEBDOMADAIRE", {}, 2026);
  const avec = calculerPaie(2000, "BIHEBDOMADAIRE", {}, 2026, { tauxFss: 4.26, tauxCnesst: 5 });
  egal(avec.salaireNet, sans.salaireNet, "net");
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

// ---- Jours fériés du Québec ----
test("Jours fériés 2026 : les huit jours, aux bonnes dates", () => {
  assert.deepEqual(joursFeriesQuebec(2026).map((f) => f.dateStr), [
    "2026-01-01", "2026-04-03", "2026-05-18", "2026-06-24", "2026-07-01", "2026-09-07", "2026-10-12", "2026-12-25",
  ]);
  assert.equal(joursFeriesQuebec(2026, { paques: "LUNDI" })[1].dateStr, "2026-04-06");
});
test("Jours fériés : 24 juin et 1er juillet un dimanche reportés au lendemain (2029)", () => {
  assert.equal(joursFeriesQuebec(2029).find((f) => f.nom === "Fête nationale").dateStr, "2029-06-25");
  assert.equal(joursFeriesQuebec(2029).find((f) => f.nom === "Fête du Canada").dateStr, "2029-07-02");
  assert.equal(joursFeriesQuebec(2027).find((f) => f.nom === "Journée nationale des patriotes").dateStr, "2027-05-24");
});

// ---- Heures supplémentaires et indemnité des jours fériés ----
// Horaire d'ouverture : 8 h du lundi au jeudi, 5 h le vendredi (37 h).
const horaire = { lun: 8, mar: 8, mer: 8, jeu: 8, ven: 5, sam: 0, dim: 0 };
// Un poinçon de `heures` heures, de jour, à une date du Québec
const poincon = (dateStr, heures) => ({ debut: new Date(`${dateStr}T13:00:00Z`), fin: new Date(new Date(`${dateStr}T13:00:00Z`).getTime() + heures * 3600000) });
const jours = (debutStr, n) => Array.from({ length: n }, (_, i) => new Date(new Date(`${debutStr}T12:00:00Z`).getTime() + i * 86400000).toISOString().slice(0, 10));
const semaineOuvrable = (lundiStr, heures) => jours(lundiStr, 5).map((j) => poincon(j, heures));

test("Semaine ordinaire : l'horaire des jours poinçonnés, aucune heure supplémentaire", () => {
  const r = calculerHeuresPeriode({ entrees: semaineOuvrable("2026-03-02", 7), debutStr: "2026-03-01", finStr: "2026-03-07", horaire });
  egal(r.heuresRegulieres, 37, "régulières");
  egal(r.heuresSupplementaires, 0, "supplémentaires");
});
test("Semaine de 50 heures : 40 régulières et 10 supplémentaires", () => {
  const r = calculerHeuresPeriode({ entrees: semaineOuvrable("2026-03-02", 10), debutStr: "2026-03-01", finStr: "2026-03-07", horaire });
  egal(r.heuresRegulieres, 40, "régulières");
  egal(r.heuresSupplementaires, 10, "supplémentaires");
});
test("Deux semaines, une seule au-delà de 40 heures", () => {
  const entrees = [...semaineOuvrable("2026-03-02", 9), ...semaineOuvrable("2026-03-09", 7)];
  const r = calculerHeuresPeriode({ entrees, debutStr: "2026-03-01", finStr: "2026-03-14", horaire });
  egal(r.heuresRegulieres, 77, "40 + 37");
  egal(r.heuresSupplementaires, 5, "45 – 40");
});
test("Semaine à cheval sur deux périodes : réglée dans la période où elle se termine", () => {
  const entrees = semaineOuvrable("2026-03-02", 10); // 50 h, du lundi 2 au vendredi 6
  // 1re période : finit le mercredi 4 — la semaine n'est pas terminée
  const p1 = calculerHeuresPeriode({ entrees, debutStr: "2026-02-19", finStr: "2026-03-04", horaire });
  egal(p1.heuresRegulieres, 24, "lundi, mardi, mercredi à l'horaire");
  egal(p1.heuresSupplementaires, 0, "pas encore réglée");
  // 2e période : la semaine s'y termine — 40 h régulières en tout, dont 24 déjà payées
  const p2 = calculerHeuresPeriode({ entrees, debutStr: "2026-03-05", finStr: "2026-03-18", horaire });
  egal(p2.heuresRegulieres, 16, "40 – 24");
  egal(p2.heuresSupplementaires, 10, "supplémentaires");
});
test("Jour férié chômé : indemnité de 1/20 des 4 semaines précédentes", () => {
  // Journée des patriotes, lundi 18 mai 2026 ; 4 semaines de 37 h avant
  const entrees = ["2026-04-20", "2026-04-27", "2026-05-04", "2026-05-11"].flatMap((l) => semaineOuvrable(l, 7));
  entrees.push(...jours("2026-05-19", 4).map((j) => poincon(j, 7))); // mardi au vendredi de la semaine du férié
  const feries = joursFeriesEntre("2026-04-01", "2026-05-23");
  const r = calculerHeuresPeriode({ entrees, debutStr: "2026-05-17", finStr: "2026-05-23", horaire, feries });
  egal(r.heuresFeries, 7.4, "148 h ÷ 20");
  egal(r.heuresRegulieres, 29, "mardi au vendredi");
  assert.equal(r.feries[0].nom, "Journée nationale des patriotes");
  assert.equal(r.feries[0].travaille, false);
});
test("Jour férié chômé : compte comme travaillé dans le calcul des 40 heures", () => {
  const entrees = jours("2026-05-19", 4).map((j) => poincon(j, 9)); // 36 h en 4 jours
  const feries = joursFeriesEntre("2026-04-01", "2026-05-23");
  const r = calculerHeuresPeriode({ entrees, debutStr: "2026-05-17", finStr: "2026-05-23", horaire, feries });
  egal(r.heuresSupplementaires, 4, "36 h + 8 h du férié – 40");
  egal(r.heuresRegulieres, 32, "40 – 8 h du férié, payé par l'indemnité");
});
test("Employé payé pour tout l'horaire : le férié est déjà payé, pas d'indemnité", () => {
  const feries = joursFeriesEntre("2026-04-01", "2026-05-23");
  const r = calculerHeuresPeriode({ entrees: [], debutStr: "2026-05-17", finStr: "2026-05-23", horaire, horaireComplet: true, feries });
  egal(r.heuresRegulieres, 37, "tout l'horaire");
  egal(r.heuresFeries, 0, "indemnité");
});

console.log(`\n${reussis} test(s) réussi(s)${process.exitCode ? " — des tests ont échoué" : ""}.`);
