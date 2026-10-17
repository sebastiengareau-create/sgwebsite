// Version en ligne, affichée au bas du menu : le commit et la branche que
// Railway a déployés (variables RAILWAY_GIT_*, fournies par Railway à
// l'exécution). Permet de vérifier qu'un client roule bien la dernière
// version de sa branche client/<id>. Côté serveur seulement.
export function versionEnLigne() {
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA;
  const branche = process.env.RAILWAY_GIT_BRANCH;
  if (!commit) return "Version de développement";
  return `Version ${commit.slice(0, 7)}${branche ? ` · ${branche}` : ""}`;
}
