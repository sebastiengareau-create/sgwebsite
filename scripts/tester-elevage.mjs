// Vérifie la ferme illustrée de l'Élevage (lib/elevageVisuel.js) : chaque
// bête au troupeau dessinée une fois, le veau juste après sa mère, la
// pastille de chaque bête (délai de retrait, poids d'abattage atteint,
// gestante) et le prochain vêlage.
//
//   node scripts/tester-elevage.mjs
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
const { betesPourFerme, etatBete, prochainVelage, echantillonFerme, CONSEILS_MOIS_FERME } = await import("../lib/elevageVisuel.js");

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

const JOUR = 86400000;
const ilYA = (j) => new Date(Date.now() - j * JOUR).toISOString();
const bete = (id, extra = {}) => ({ id, numero: id, statut: "ACTIVE", sexe: "FEMELLE", dateNaissance: ilYA(1500), pesees: [], soins: [], saillies: [], ...extra });

test("Ferme : chaque bête au troupeau une fois, le veau après sa mère", () => {
  const betes = [
    bete("VEAU", { mereId: "MERE", dateNaissance: ilYA(20) }),
    bete("TAUREAU", { sexe: "TAUREAU" }),
    bete("MERE"),
    bete("VENDUE", { statut: "VENDUE" }),
  ];
  const ordre = betesPourFerme(betes, 750).map((b) => b.id);
  assert.deepEqual(ordre, ["TAUREAU", "MERE", "VEAU"], "les bêtes sorties du troupeau ne sont pas dessinées");
  assert.equal(betesPourFerme(betes, 750).find((b) => b.id === "VEAU").categorie, "VEAU");
  assert.equal(CONSEILS_MOIS_FERME.length, 12, "un conseil par mois");
});

test("Ferme : pastille de chaque bête", () => {
  assert.equal(etatBete(bete("A"), 750), null);
  assert.equal(etatBete(bete("B", { soins: [{ date: ilYA(2), type: "TRAITEMENT", retraitJours: 30 }] }), 750), "RETRAIT");
  assert.equal(etatBete(bete("C", { saillies: [{ date: ilYA(100), statut: "GESTANTE" }] }), 750), "GESTANTE");
  const pret = bete("D", { sexe: "BOUVILLON", dateNaissance: ilYA(800), pesees: [{ date: ilYA(3), poids: 760 }] });
  assert.equal(etatBete(pret, 750), "PRETE", "bouvillon au poids d'abattage");
  assert.equal(etatBete({ ...pret, soins: [{ date: ilYA(1), type: "TRAITEMENT", retraitJours: 10 }] }, 750), "RETRAIT", "le retrait passe avant l'abattage");
});

test("Ferme : prochain vêlage", () => {
  const betes = [bete("A", { saillies: [{ date: ilYA(275), statut: "GESTANTE" }] }), bete("B", { saillies: [{ date: ilYA(100), statut: "GESTANTE" }] })];
  const v = prochainVelage(betes);
  assert.equal(v.bete.id, "A");
  assert.equal(v.jours, 10, "285 jours de gestation");
  assert.equal(prochainVelage([bete("C")]), null);
});

test("Ferme : un troupeau de quelques centaines de bêtes est représenté", () => {
  const liste = [];
  for (let i = 0; i < 300; i++) {
    const categorie = i < 120 ? "VACHE" : i < 200 ? "VEAU" : i < 290 ? "BOUVILLON" : "TAUREAU";
    liste.push({ id: `B${i}`, categorie, etat: i % 50 === 0 ? "RETRAIT" : null });
  }
  const { visibles, autres } = echantillonFerme(liste, 36);
  assert.equal(visibles.length, 36);
  assert.equal(autres, 264);
  assert.equal(visibles.filter((b) => b.etat).length, 6, "toutes les bêtes à surveiller y sont");
  const n = (c) => visibles.filter((b) => b.categorie === c).length;
  assert.ok(n("VACHE") > n("BOUVILLON") && n("BOUVILLON") > n("TAUREAU") && n("TAUREAU") >= 1, "la composition du troupeau est respectée");
  assert.deepEqual(echantillonFerme(liste.slice(0, 10), 36), { visibles: liste.slice(0, 10), autres: 0 }, "petit troupeau : toutes les bêtes");
});

console.log(`\n${reussis} test${reussis > 1 ? "s" : ""} réussi${reussis > 1 ? "s" : ""}${process.exitCode ? " — des tests ont échoué" : ""}.`);
