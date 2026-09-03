// Sauvegarde automatique quotidienne, envoyée par courriel (le serveur n'a
// pas d'espace de stockage permanent — voir lib/sauvegarde.js). Si aucun
// courriel n'est configuré (paramètre "sauvegarde_auto_courriel" vide ou
// absent), rien ne se passe — seule la sauvegarde manuelle reste disponible.
const { prisma } = require("./prisma");
const { exporterDonnees } = require("./sauvegarde");
const { dateQuebecStr } = require("./temps");

const CLE_COURRIEL = "sauvegarde_auto_courriel";
const CLE_DERNIERE_DATE = "sauvegarde_auto_derniere_date";
const INTERVALLE_VERIFICATION_MS = 60 * 60 * 1000; // vérifie une fois par heure

async function verifierEtEnvoyerSauvegardeAuto() {
  try {
    const [parametreCourriel, parametreDerniereDate] = await Promise.all([
      prisma.parametre.findUnique({ where: { cle: CLE_COURRIEL } }),
      prisma.parametre.findUnique({ where: { cle: CLE_DERNIERE_DATE } }),
    ]);
    const courriel = parametreCourriel?.valeur?.trim();
    if (!courriel) return; // pas configuré — sauvegarde manuelle seulement

    const aujourdhui = dateQuebecStr(new Date());
    if (parametreDerniereDate?.valeur === aujourdhui) return; // déjà envoyée aujourd'hui

    if (!process.env.RESEND_API_KEY) {
      console.error("Sauvegarde automatique impossible : RESEND_API_KEY manquant.");
      return;
    }

    const donnees = await exporterDonnees();
    const contenu = JSON.stringify(donnees, null, 2);

    const { Resend } = require("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const adresseEnvoi = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    const { error } = await resend.emails.send({
      from: `Sauvegarde automatique <${adresseEnvoi}>`,
      to: courriel,
      subject: `Sauvegarde automatique — ${aujourdhui}`,
      text: `Voici la sauvegarde automatique quotidienne de ${aujourdhui}, en pièce jointe.`,
      attachments: [{ filename: `sauvegarde-${aujourdhui}.json`, content: Buffer.from(contenu).toString("base64") }],
    });
    if (error) {
      console.error("Échec de l'envoi de la sauvegarde automatique :", error);
      return;
    }

    await prisma.parametre.upsert({
      where: { cle: CLE_DERNIERE_DATE },
      update: { valeur: aujourdhui },
      create: { cle: CLE_DERNIERE_DATE, valeur: aujourdhui },
    });
  } catch (e) {
    console.error("Erreur lors de la vérification de la sauvegarde automatique :", e);
  }
}

let demarre = false;
function demarrerPlanificateurSauvegarde() {
  if (demarre) return; // évite de dupliquer l'intervalle si register() est rappelé
  demarre = true;
  verifierEtEnvoyerSauvegardeAuto();
  setInterval(verifierEtEnvoyerSauvegardeAuto, INTERVALLE_VERIFICATION_MS);
}

module.exports = { demarrerPlanificateurSauvegarde, verifierEtEnvoyerSauvegardeAuto, CLE_COURRIEL, CLE_DERNIERE_DATE };
