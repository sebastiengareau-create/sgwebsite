const { prisma } = require("./prisma");

// Un bon facturé est figé — plus aucune modification de ses tâches, pièces,
// temps, photos ou escompte. La seule façon de le débloquer est d'annuler
// la facture (bouton réservé au gérant), qui remet le bon "En cours".
async function bonEstVerrouille(bonId) {
  const facture = await prisma.facture.findUnique({ where: { bonId }, select: { id: true } });
  return !!facture;
}

const MESSAGE_BON_VERROUILLE = "Ce bon est facturé et ne peut plus être modifié — annule la facture d'abord si une correction est nécessaire.";

// Le bon passe automatiquement "En cours" dès que du temps lui est attribué
// (poinçon démarré ou temps saisi manuellement), s'il était encore "En attente".
async function passerBonEnCoursSiEnAttente(bonId) {
  await prisma.bonTravail.updateMany({ where: { id: bonId, statut: "EN_ATTENTE" }, data: { statut: "EN_COURS" } });
}

// À l'inverse, un bon "En cours" revient "En attente" quand on supprime sa
// dernière entrée de temps (plus aucune main-d'œuvre sur aucune tâche).
async function remettreBonEnAttenteSiSansTemps(bonId) {
  const resteDuTemps = await prisma.entreeTemps.count({ where: { probleme: { bonId } } });
  if (resteDuTemps > 0) return;
  await prisma.bonTravail.updateMany({ where: { id: bonId, statut: "EN_COURS" }, data: { statut: "EN_ATTENTE" } });
}

module.exports = { bonEstVerrouille, MESSAGE_BON_VERROUILLE, passerBonEnCoursSiEnAttente, remettreBonEnAttenteSiSansTemps };
