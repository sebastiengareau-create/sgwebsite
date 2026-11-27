// Réglages de départ du profil (reglagesDemarrage, lib/client.js), écrits
// dans la base au démarrage du serveur (instrumentation.js), seulement s'ils
// n'y sont pas encore : une démo de déclinaison (Immobilier, Copropriété…)
// démarre avec ses modules actifs, et ce que l'Administrateur change ensuite
// n'est jamais réécrit. Sans réglages dans le profil, rien ne se passe.
const { prisma } = require("./prisma");
const { CLIENT } = require("./client");

async function appliquerReglagesDemarrage() {
  const reglages = Object.entries(CLIENT.reglagesDemarrage || {});
  if (!reglages.length) return;
  try {
    const { count } = await prisma.parametre.createMany({
      data: reglages.map(([cle, valeur]) => ({ cle, valeur: String(valeur) })),
      skipDuplicates: true,
    });
    if (count) console.log(`Réglages de départ du profil « ${CLIENT.id} » : ${count} inscrit(s).`);
  } catch (e) {
    console.error("Réglages de départ du profil non inscrits :", e.message);
  }
}

module.exports = { appliquerReglagesDemarrage };
