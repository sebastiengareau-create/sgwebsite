const { Resend } = require("resend");
const { obtenirInfosEntreprise } = require("./config");
const { libelleVehicule } = require("./vehicules");

// Courriel au client : son véhicule est prêt à être récupéré. Envoyé au
// choix depuis un bon facturé (POST /api/bons/[id]/avis-pret), avec Resend
// comme l'envoi de la facture. Lance une erreur si l'envoi échoue.
// bon doit inclure client et vehicule.
async function envoyerAvisVehiculePret(bon, destinataire) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant).");
  }
  const { nomEntreprise, telephone, adresseLigne1, adresseLigne2 } = await obtenirInfosEntreprise();
  const vehicule = bon.vehicule ? libelleVehicule(bon.vehicule) : "";
  const adresse = [adresseLigne1, adresseLigne2].filter(Boolean).join(", ");

  const details = [
    adresse && `Adresse : ${adresse}`,
    telephone && `Pour toute question : ${telephone}`,
    `Bon de travail : #${bon.numero}`,
  ].filter(Boolean);
  const lignes = [
    `Bonjour ${bon.client.nom},`,
    "",
    vehicule ? `Votre véhicule (${vehicule}) est prêt.` : "Votre véhicule est prêt.",
    "Vous pouvez venir le récupérer.",
    "",
    ...details,
    "",
    "Merci de votre confiance,",
    nomEntreprise,
  ];

  const resend = new Resend(process.env.RESEND_API_KEY);
  const adresseEnvoi = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const { error } = await resend.emails.send({
    from: `${nomEntreprise} <${adresseEnvoi}>`,
    to: destinataire,
    subject: `Votre véhicule est prêt — ${nomEntreprise}`,
    text: lignes.join("\n"),
  });
  if (error) throw new Error(error.message || JSON.stringify(error));
}

module.exports = { envoyerAvisVehiculePret };
