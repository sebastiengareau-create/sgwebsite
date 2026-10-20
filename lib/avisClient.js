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

// Courriel au client avec les photos prises pendant les tâches du bon, en
// pièces jointes (profil envoiPhotosCourriel ; POST /api/bons/[id]/envoyer-photos).
// photos : [{ url (dataUrl), tache }]. Lance une erreur si l'envoi échoue.
async function envoyerPhotosTaches(bon, photos, destinataire) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant).");
  }
  const { nomEntreprise, telephone } = await obtenirInfosEntreprise();
  const vehicule = bon.vehicule ? libelleVehicule(bon.vehicule) : "";

  const attachments = photos.map((p, i) => {
    const m = /^data:image\/(\w+);base64,(.+)$/s.exec(p.url || "");
    if (!m) return null;
    const ext = m[1] === "jpeg" ? "jpg" : m[1];
    return { filename: `photo-${String(i + 1).padStart(2, "0")}.${ext}`, content: m[2] };
  }).filter(Boolean);
  if (attachments.length === 0) throw new Error("Aucune photo à envoyer.");

  const taches = [...new Set(photos.map((p) => p.tache).filter(Boolean))];
  const lignes = [
    `Bonjour ${bon.client.nom},`,
    "",
    `Voici les photos prises lors des travaux${vehicule ? ` sur votre véhicule (${vehicule})` : ""}, en pièces jointes.`,
    ...(taches.length ? ["", "Travaux :", ...taches.map((t) => `- ${t}`)] : []),
    "",
    `Bon de travail : #${bon.numero}`,
    ...(telephone ? [`Pour toute question : ${telephone}`] : []),
    "",
    "Merci de votre confiance,",
    nomEntreprise,
  ];

  const resend = new Resend(process.env.RESEND_API_KEY);
  const adresseEnvoi = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const { error } = await resend.emails.send({
    from: `${nomEntreprise} <${adresseEnvoi}>`,
    to: destinataire,
    subject: `Photos des travaux — bon #${bon.numero} — ${nomEntreprise}`,
    text: lignes.join("\n"),
    attachments,
  });
  if (error) throw new Error(error.message || JSON.stringify(error));
  return attachments.length;
}

module.exports = { envoyerAvisVehiculePret, envoyerPhotosTaches };
