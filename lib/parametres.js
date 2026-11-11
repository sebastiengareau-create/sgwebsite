// Lecture des réglages (table Parametre) mémorisée le temps d'une requête.
//
// Chaque page affichée demande les mêmes réglages à plusieurs endroits (mise
// en page, en-tête, vérifications d'accès, modules actifs…). Sans mémoire,
// chacun fait sa propre lecture de la base, l'une après l'autre. Ici :
//   - une clé déjà lue pendant la requête n'est jamais relue ;
//   - lireParametres([...]) lit plusieurs clés en une seule requête.
//
// La mémoire (React cache) ne vit que le temps du rendu d'une page : une
// requête suivante relit toujours la base, donc un réglage changé est vu
// tout de suite. Hors d'un rendu (routes d'API, tâches planifiées), rien
// n'est mémorisé — chaque appel lit la base, comme avant.
const { cache } = require("react");

const memoire = cache(() => new Map()); // clé → promesse de la valeur (ou undefined si absente)

// { cle: valeur } pour les clés demandées — absente de la base = absente du résultat
async function lireParametres(cles) {
  const { prisma } = require("./prisma");
  const carte = memoire();
  const aLire = [...new Set(cles)].filter((cle) => !carte.has(cle));
  if (aLire.length > 0) {
    const lecture = prisma.parametre.findMany({ where: { cle: { in: aLire } } })
      .then((lignes) => Object.fromEntries(lignes.map((p) => [p.cle, p.valeur])));
    for (const cle of aLire) carte.set(cle, lecture.then((dict) => dict[cle]));
  }
  const resultat = {};
  await Promise.all(cles.map(async (cle) => {
    const valeur = await carte.get(cle);
    if (valeur !== undefined) resultat[cle] = valeur;
  }));
  return resultat;
}

// Valeur d'une clé, ou undefined si elle n'est pas dans la base
async function lireParametre(cle) {
  return (await lireParametres([cle]))[cle];
}

module.exports = { lireParametres, lireParametre };
