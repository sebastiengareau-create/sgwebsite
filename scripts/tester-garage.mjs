// Vérifie l'atelier illustré de la Vue d'ensemble (lib/garageVisuel.js) :
// chaque bon pas encore facturé y paraît une fois — en cours aux portes
// (chrono en marche d'abord), en attente ou prêt (client avisé) dans la cour ;
// pour un atelier de VR, les VR à vendre dans la cour de vente.
//
//   node scripts/tester-garage.mjs
//
// Aucune base de données n'est lue.
import assert from "node:assert/strict";
import { register } from "node:module";

register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    try { return await next(specifier, context); }
    catch (e) { if (/^\\.\\.?\\//.test(specifier) && !/\\.[cm]?js$/.test(specifier)) return next(specifier + ".js", context); throw e; }
  }
`));
const { vehiculesAtelier, vehiculesAVendrePourAtelier, CONSEILS_MOIS_GARAGE, CONSEILS_MOIS_VR } = await import("../lib/garageVisuel.js");

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

test("Atelier : chaque bon à sa place", () => {
  const bons = [
    { id: "a", numero: "1001", statut: "EN_ATTENTE", vehicule: { id: "v1", marque: "Honda", modele: "Civic", annee: 2019 }, client: { nom: "Jean" } },
    { id: "b", numero: "1002", statut: "EN_COURS" },
    { id: "c", numero: "1003", statut: "EN_COURS", avisPretLe: "2026-11-27" },
    { id: "d", numero: "1004", statut: "EN_COURS" },
  ];
  const { portes, cour } = vehiculesAtelier(bons, { d: ["Maude"] });
  assert.deepEqual(portes.map((v) => [v.id, v.etat]), [["d", "TRAVAIL"], ["b", "COURS"]], "chrono en marche d'abord");
  assert.deepEqual(cour.map((v) => [v.id, v.etat]), [["c", "PRET"], ["a", "ATTENTE"]], "prêts près de la porte, puis en attente");
  assert.match(cour[1].texte, /Bon 1001 · Honda Civic 2019 · Jean · en attente/);
  assert.match(portes[0].texte, /au travail : Maude/);
  assert.equal(CONSEILS_MOIS_GARAGE.length, 12, "un conseil par mois");
});

test("Atelier de VR : cour de vente et calendrier", () => {
  const liste = vehiculesAVendrePourAtelier([
    { id: "x", numero: "VV-001", prixDemande: 112900, vehicule: { id: "v9", marque: "Jayco", modele: "Eagle", annee: 2024 } },
    { id: "y", numero: "VV-002", prixDemande: 0, vehicule: null },
  ]);
  assert.deepEqual(liste.map((v) => [v.id, v.etat, v.cle]), [["x", "VENTE", "v9"], ["y", "VENTE", "y"]]);
  assert.match(liste[0].prix, /^112\s900 \$$/, "prix arrondi, à la québécoise");
  assert.match(liste[0].texte, /VV-001 · Jayco Eagle 2024 · 112\s900 \$ demandé · à vendre/);
  assert.equal(liste[1].prix, null, "sans prix demandé, pas d'étiquette");
  assert.equal(liste[1].texte, "VV-002 · à vendre");
  assert.equal(CONSEILS_MOIS_VR.length, 12, "un conseil par mois");
  assert.match(CONSEILS_MOIS_VR[9].texte, /Hivernisation/, "octobre : hivernisation");
});

console.log(`\n${reussis} test${reussis > 1 ? "s" : ""} réussi${reussis > 1 ? "s" : ""}${process.exitCode ? " — des tests ont échoué" : ""}.`);
