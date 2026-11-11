// Approbation d'une soumission en ligne : règles et calculs sans dépendance
// au serveur, utilisables aussi dans le navigateur (page du client). Le
// reste : lib/approbationSoumission.js.

// Le client peut encore répondre : soumission en attente, pas encore
// transformée, et pas déjà répondue
export function peutRepondre(soumission) {
  return soumission.statut === "EN_ATTENTE" && !soumission.bonId && !soumission.reponseClient;
}

// Tâches à reprendre sur le bon ou la facture : toutes, sauf celles que le
// client a décochées en approuvant en ligne
export function tachesRetenues(soumission) {
  if (soumission.reponseClient !== "APPROUVEE") return soumission.taches;
  return soumission.taches.filter((t) => !t.refusee);
}

// Montants d'une liste de tâches (heures × taux, pièces, taxes)
export function totauxTaches(taches, { tauxHoraire, tpsTaux, tvqTaux }) {
  const mainOeuvre = taches.reduce((s, t) => s + (t.tempsEstime || 0) * tauxHoraire, 0);
  const pieces = taches.reduce((s, t) => s + t.pieces.reduce((s2, p) => s2 + p.prixEstime * p.qte, 0), 0);
  const sousTotal = mainOeuvre + pieces;
  const tps = sousTotal * (tpsTaux / 100);
  const tvq = sousTotal * (tvqTaux / 100);
  return { mainOeuvre, pieces, sousTotal, tps, tvq, total: sousTotal + tps + tvq };
}
