// Sauvegarde automatique quotidienne, envoyée par courriel (le serveur n'a
// pas d'espace de stockage permanent — voir lib/sauvegarde.js), sans les
// photos des bons pour rester petite. Si aucun
// courriel n'est configuré (paramètre "sauvegarde_auto_courriel" vide ou
// absent), rien ne se passe — seule la sauvegarde manuelle reste disponible.
const zlib = require("zlib");
const { prisma } = require("./prisma");
const { exporterDonnees } = require("./sauvegarde");
const { dateQuebecStr } = require("./temps");
const { effacerFichiersExpires } = require("./fichiersRendezVous");
const { verifierNotificationsPeriodiques } = require("./notificationsPeriodiques");
const { verifierNotificationsCedulees } = require("./notificationsCedulees");
const { verifierRappelPoincons } = require("./rappelPoincons");

const CLE_COURRIEL = "sauvegarde_auto_courriel";
const CLE_DERNIERE_DATE = "sauvegarde_auto_derniere_date";
// Résultat du dernier essai (JSON { le, ok, message }), affiché sur la page
// Sauvegarde : sans lui, un envoi refusé ne laissait qu'une ligne dans les
// journaux du serveur, et personne ne savait que la sauvegarde ne partait plus.
const CLE_DERNIER_RESULTAT = "sauvegarde_auto_dernier_resultat";
const INTERVALLE_VERIFICATION_MS = 60 * 60 * 1000; // vérifie une fois par heure
const INTERVALLE_CEDULEES_MS = 60 * 1000; // notifications cédulées : regard en mémoire chaque minute

// Resend refuse un courriel de plus de 40 Mo, pièces jointes encodées en
// base64 comprises (+33 %) : la pièce jointe doit rester sous ~30 Mo.
const TAILLE_MAX_PIECE_JOINTE = 28 * 1024 * 1024;

function formatMo(octets) {
  return `${(octets / 1048576).toFixed(1)} Mo`;
}

async function enregistrerResultat(ok, message) {
  const valeur = JSON.stringify({ le: new Date().toISOString(), ok, message });
  await prisma.parametre.upsert({
    where: { cle: CLE_DERNIER_RESULTAT },
    update: { valeur },
    create: { cle: CLE_DERNIER_RESULTAT, valeur },
  });
}

async function marquerEnvoyeeAujourdhui(aujourdhui) {
  await prisma.parametre.upsert({
    where: { cle: CLE_DERNIERE_DATE },
    update: { valeur: aujourdhui },
    create: { cle: CLE_DERNIERE_DATE, valeur: aujourdhui },
  });
}

// forcer : envoie même si la sauvegarde du jour est déjà partie (bouton
// « Envoyer maintenant »). Retourne { ok, message }.
async function verifierEtEnvoyerSauvegardeAuto({ forcer = false } = {}) {
  try {
    const [parametreCourriel, parametreDerniereDate] = await Promise.all([
      prisma.parametre.findUnique({ where: { cle: CLE_COURRIEL } }),
      prisma.parametre.findUnique({ where: { cle: CLE_DERNIERE_DATE } }),
    ]);
    const courriel = parametreCourriel?.valeur?.trim();
    if (!courriel) return { ok: false, message: "Aucun courriel configuré." }; // sauvegarde manuelle seulement

    const aujourdhui = dateQuebecStr(new Date());
    if (!forcer && parametreDerniereDate?.valeur === aujourdhui) return { ok: true, message: "Déjà envoyée aujourd'hui." };

    if (!process.env.RESEND_API_KEY) {
      const message = "Envoi impossible : la clé RESEND_API_KEY manque sur le serveur.";
      console.error("Sauvegarde automatique :", message);
      await enregistrerResultat(false, message);
      return { ok: false, message };
    }

    // Sans les photos (elles ne feraient que grossir — voir MODELES_PHOTOS
    // dans lib/sauvegarde.js), compressée (gzip) et sans mise en forme : reste
    // loin sous la limite de taille des courriels. La restauration accepte le
    // .json.gz tel quel.
    const donnees = await exporterDonnees({ sansPhotos: true });
    const compresse = zlib.gzipSync(Buffer.from(JSON.stringify(donnees)));

    const { Resend } = require("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const adresseEnvoi = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const envoi = {
      from: `Sauvegarde automatique <${adresseEnvoi}>`,
      to: courriel,
      subject: `Sauvegarde automatique — ${aujourdhui}`,
    };

    if (compresse.length > TAILLE_MAX_PIECE_JOINTE) {
      // Trop lourde pour un courriel : on avertit plutôt que d'échouer en silence
      const message = `Sauvegarde trop volumineuse pour un courriel (${formatMo(compresse.length)} compressée, maximum ${formatMo(TAILLE_MAX_PIECE_JOINTE)}). Télécharge-la à la main : Administrateur → Sauvegarde.`;
      const { error } = await resend.emails.send({
        ...envoi,
        subject: `⚠️ Sauvegarde automatique non jointe — ${aujourdhui}`,
        text: `${message}\n\nLa sauvegarde automatique de ${aujourdhui} n'a pas pu être jointe à ce courriel.`,
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
      await marquerEnvoyeeAujourdhui(aujourdhui); // un seul avertissement par jour
      await enregistrerResultat(false, message);
      return { ok: false, message };
    }

    const { error } = await resend.emails.send({
      ...envoi,
      text: `Voici la sauvegarde automatique quotidienne de ${aujourdhui}, en pièce jointe (fichier compressé .json.gz, ${formatMo(compresse.length)}).\n\nElle contient toutes les données (clients, bons, factures, inventaire, comptabilité, paie…), sauf les photos des bons, trop lourdes pour un courriel. Pour une copie avec les photos : Administrateur → Sauvegarde → Télécharger la sauvegarde.\n\nPour restaurer : Administrateur → Sauvegarde → Restaurer, et choisir ce fichier tel quel. Les photos déjà dans le logiciel restent en place.`,
      attachments: [{ filename: `sauvegarde-${aujourdhui}.json.gz`, content: compresse.toString("base64") }],
    });
    if (error) throw new Error(error.message || JSON.stringify(error));

    await marquerEnvoyeeAujourdhui(aujourdhui);
    const message = `Envoyée à ${courriel} (${formatMo(compresse.length)}, sans les photos).`;
    await enregistrerResultat(true, message);
    return { ok: true, message };
  } catch (e) {
    console.error("Erreur lors de la sauvegarde automatique :", e);
    const message = `Échec de l'envoi : ${e?.message || e}. Nouvel essai dans une heure.`;
    try {
      await enregistrerResultat(false, message);
    } catch {}
    return { ok: false, message };
  }
}

// Fichiers joints aux rendez-vous : effacés 12 mois après le rendez-vous
async function effacerFichiersRendezVousExpires() {
  try {
    await effacerFichiersExpires();
  } catch (e) {
    console.error("Erreur lors de l'effacement des fichiers de rendez-vous expirés :", e);
  }
}

// Pièces sous le seuil, comptes à payer bientôt dus (voir lib/notificationsPeriodiques.js)
async function verifierNotifications() {
  try {
    await verifierNotificationsPeriodiques();
  } catch (e) {
    console.error("Erreur lors de la vérification des notifications :", e);
  }
}

// Rappels à heure fixe (voir lib/notificationsCedulees.js) — ne lit la
// base qu'à l'heure de la prochaine
async function verifierCedulees() {
  try {
    await verifierNotificationsCedulees();
  } catch (e) {
    console.error("Erreur lors de l'envoi des notifications cédulées :", e);
  }
}

// Rappel aux employés encore poinçonnés une heure après la fermeture (voir
// lib/rappelPoincons.js) — ne lit la base qu'à l'heure du prochain rappel
async function verifierRappels() {
  try {
    await verifierRappelPoincons();
  } catch (e) {
    console.error("Erreur lors du rappel des poinçons oubliés :", e);
  }
}

async function verifierTachesPeriodiques() {
  await verifierEtEnvoyerSauvegardeAuto();
  await effacerFichiersRendezVousExpires();
  await verifierNotifications();
}

let demarre = false;
function demarrerPlanificateurSauvegarde() {
  if (demarre) return; // évite de dupliquer l'intervalle si register() est rappelé
  demarre = true;
  verifierTachesPeriodiques();
  setInterval(verifierTachesPeriodiques, INTERVALLE_VERIFICATION_MS);
  setInterval(verifierCedulees, INTERVALLE_CEDULEES_MS);
  setInterval(verifierRappels, INTERVALLE_CEDULEES_MS);
}

module.exports = { demarrerPlanificateurSauvegarde, verifierEtEnvoyerSauvegardeAuto, CLE_COURRIEL, CLE_DERNIERE_DATE, CLE_DERNIER_RESULTAT };
