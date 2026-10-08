const { prisma } = require("./prisma");
const { envoyerSms, lireConfigSms } = require("./sms");
const { obtenirInfosEntreprise } = require("./config");
const { texteVehicule } = require("./recherchePieces");
const { aAccesSection } = require("./auth");

// Module « Jobs en déplacement » (envoi de bons aux employés, SMS, GPS) :
// inactif tant que le super-administrateur ne l'active pas dans
// Administrateur → Modules. Inactif, tout est caché et les API refusent.
const CLE_MODULE = "module_jobs_deplacement";
async function jobsDeplacementActif() {
  const p = await prisma.parametre.findUnique({ where: { cle: CLE_MODULE } });
  return p?.valeur === "actif";
}

// Peut envoyer des bons, les annuler et suivre les employés
async function peutGererJobsDeplacement(session) {
  return (await jobsDeplacementActif()) && (await aAccesSection(session, "jobs-deplacement"));
}

const INCLURE_BON = {
  include: {
    client: true,
    vehicule: true,
    problemes: { orderBy: { id: "asc" }, select: { description: true } },
  },
};

function texteSms(nomEntreprise, bon, message, adressePublique) {
  const adresse = [bon.client.adresse, bon.client.ville].filter(Boolean).join(", ");
  const taches = bon.problemes.map((p) => p.description).filter(Boolean);
  const lignes = [
    `${nomEntreprise} : nouvelle tâche pour toi — bon #${bon.numero}, ${bon.client.nom}`,
    texteVehicule(bon.vehicule),
    adresse && `📍 ${adresse}`,
    taches.length > 0 && `• ${taches.slice(0, 3).join("\n• ")}${taches.length > 3 ? `\n(+${taches.length - 3} autres)` : ""}`,
    message && `Note : ${message}`,
    `Voir : ${adressePublique}/mes-taches`,
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
  const config = await lireConfigSms();
  const resultat = await envoyerSms(envoi.employe.telephone, texteSms(nomEntreprise, envoi.bon, envoi.message, config.adressePublique), config);
  return prisma.envoiBon.update({
    where: { id: envoiId },
    data: { smsStatut: resultat.statut, smsErreur: resultat.erreur || null },
  });
}

module.exports = { envoyerSmsEnvoi, jobsDeplacementActif, peutGererJobsDeplacement };
