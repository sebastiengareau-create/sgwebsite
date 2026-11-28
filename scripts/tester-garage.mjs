// Vérifie l'atelier illustré de la Vue d'ensemble (lib/garageVisuel.js) :
// chaque bon pas encore facturé y paraît une fois — en cours aux portes
// (chrono en marche d'abord), en attente ou prêt (client avisé) dans la cour.
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
const { vehiculesAtelier, CONSEILS_MOIS_GARAGE } = await import("../lib/garageVisuel.js");

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

console.log(`\n${reussis} test${reussis > 1 ? "s" : ""} réussi${reussis > 1 ? "s" : ""}${process.exitCode ? " — des tests ont échoué" : ""}.`);
