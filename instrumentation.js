// Démarre le vérificateur de sauvegarde automatique une seule fois, au
// démarrage du serveur — voir lib/planificateurSauvegarde.js.
async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Sans SESSION_SECRET, les sessions sont signées avec une valeur connue
    // de quiconque lit le code : n'importe qui pourrait se fabriquer un accès.
    if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
      console.error("⚠️  SESSION_SECRET n'est pas défini : les sessions ne sont pas protégées. Ajoute cette variable dans Railway (voir GUIDE-NOUVEAU-CLIENT.md).");
    }
    const { demarrerPlanificateurSauvegarde } = require("./lib/planificateurSauvegarde");
    demarrerPlanificateurSauvegarde();
  }
}

module.exports = { register };
