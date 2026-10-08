const { prisma } = require("./prisma");
const { envoyerSms } = require("./sms");
const { obtenirInfosEntreprise } = require("./config");
const { texteVehicule } = require("./recherchePieces");

const INCLURE_BON = {
  include: {
    client: true,
    vehicule: true,
    problemes: { orderBy: { id: "asc" }, select: { description: true } },
  },
};

function texteSms(nomEntreprise, bon, message) {
  const adresse = [bon.client.adresse, bon.client.ville].filter(Boolean).join(", ");
  const taches = bon.problemes.map((p) => p.description).filter(Boolean);
  const lignes = [
    `${nomEntreprise} : nouvelle tâche pour toi — bon #${bon.numero}, ${bon.client.nom}`,
    texteVehicule(bon.vehicule),
    adresse && `📍 ${adresse}`,
    taches.length > 0 && `• ${taches.slice(0, 3).join("\n• ")}${taches.length > 3 ? `\n(+${taches.length - 3} autres)` : ""}`,
    message && `Note : ${message}`,
    `Voir : ${process.env.APP_URL || "http://localhost:3000"}/mes-taches`,
  ];
  return lignes.filter(Boolean).join("\n");
}

// Envoie (ou renvoie) le SMS d'un envoi et enregistre le résultat
async function envoyerSmsEnvoi(envoiId) {
  const envoi = await prisma.envoiBon.findUnique({
    where: { id: envoiId },
    include: { employe: { select: { telephone: true } }, bon: INCLURE_BON },
  });
  if (!envoi) return null;
  const { nomEntreprise } = await obtenirInfosEntreprise();
  const resultat = await envoyerSms(envoi.employe.telephone, texteSms(nomEntreprise, envoi.bon, envoi.message));
  return prisma.envoiBon.update({
    where: { id: envoiId },
    data: { smsStatut: resultat.statut, smsErreur: resultat.erreur || null },
  });
}

module.exports = { envoyerSmsEnvoi };
