// Démarre le vérificateur de sauvegarde automatique une seule fois, au
// démarrage du serveur — voir lib/planificateurSauvegarde.js.
async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { demarrerPlanificateurSauvegarde } = require("./lib/planificateurSauvegarde");
    demarrerPlanificateurSauvegarde();
  }
}

module.exports = { register };
