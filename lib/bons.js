const { prisma } = require("./prisma");

// Un bon facturé est figé — plus aucune modification de ses tâches, pièces,
// temps, photos ou escompte. La seule façon de le débloquer est d'annuler
// la facture (bouton réservé au gérant), qui remet le bon "En cours".
async function bonEstVerrouille(bonId) {
  const facture = await prisma.facture.findUnique({ where: { bonId }, select: { id: true } });
  return !!facture;
}

const MESSAGE_BON_VERROUILLE = "Ce bon est facturé et ne peut plus être modifié — annule la facture d'abord si une correction est nécessaire.";

module.exports = { bonEstVerrouille, MESSAGE_BON_VERROUILLE };
