const { prisma } = require("./prisma");
const { obtenirInfosEntreprise } = require("./config");
const { texteVehicule } = require("./recherchePieces");
const { aAccesSection } = require("./auth");
const { notifier } = require("./notifications");

// Module « Jobs en déplacement » (envoi de bons aux employés, GPS) :
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

// Texte du courriel de secours
function texteAvis(nomEntreprise, bon, message, adressePublique) {
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

// Avise l'employé d'un envoi (ou l'avise à nouveau) et note par où :
//  1. notification sur son téléphone — gratuite, si activée ;
//  2. courriel — en dernier recours, si la notification ne l'a pas atteint.
async function envoyerAvisEnvoi(envoiId) {
  const envoi = await prisma.envoiBon.findUnique({
    where: { id: envoiId },
    include: { employe: { select: { id: true, nom: true, courriel: true } }, bon: INCLURE_BON },
  });
  if (!envoi) return null;
  const { nomEntreprise } = await obtenirInfosEntreprise();
  const adressePublique = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const texte = texteAvis(nomEntreprise, envoi.bon, envoi.message, adressePublique);
  const avisPar = [];

  const atteints = await notifier("BON_ENVOYE", {
    employeIds: [envoi.employe.id],
    titre: `Nouvelle tâche — bon #${envoi.bon.numero}`,
    corps: [envoi.bon.client.nom, texteVehicule(envoi.bon.vehicule), envoi.message].filter(Boolean).join(" · "),
    url: "/mes-taches",
    tag: `envoi-${envoi.id}`,
  });
  if (atteints[envoi.employe.id] > 0) avisPar.push("PUSH");

  if (avisPar.length === 0 && (await envoyerCourriel(envoi.employe.courriel, `${nomEntreprise} — nouvelle tâche : bon #${envoi.bon.numero}`, texte))) {
    avisPar.push("COURRIEL");
  }

  return prisma.envoiBon.update({
    where: { id: envoiId },
    data: { avisPar, smsStatut: "NON_CONFIGURE", smsErreur: null },
  });
}

// Courriel par Resend (déjà utilisé pour les factures). Faux si non
// configuré ou en échec — c'est un avis de secours, il ne bloque rien.
async function envoyerCourriel(destinataire, sujet, texte) {
  if (!process.env.RESEND_API_KEY || !destinataire) return false;
  const { Resend } = require("resend");
  const { nomEntreprise } = await obtenirInfosEntreprise();
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `${nomEntreprise} <${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}>`,
      to: destinataire,
      subject: sujet,
      text: texte,
    });
    if (error) console.error("Courriel d'avis non envoyé :", error.message || error);
    return !error;
  } catch (e) {
    console.error("Courriel d'avis non envoyé :", e.message);
    return false;
  }
}

module.exports = { envoyerAvisEnvoi, jobsDeplacementActif, peutGererJobsDeplacement };
