// ============================================================
// NOTIFICATIONS SUR LE TÉLÉPHONE (Web Push) — gratuites
// ============================================================
// L'employé les active une fois dans « Mes tâches » : son navigateur
// donne une adresse d'abonnement (table AbonnementPush), où le serveur
// envoie ensuite les avis. Le service de notifications du navigateur
// (Google, Apple, Mozilla) les livre gratuitement, même app fermée.
// iPhone : l'app doit d'abord être ajoutée à l'écran d'accueil.
//
// Les clés VAPID (qui signent les envois) sont créées toutes seules au
// premier usage et gardées dans la table Parametre : rien à configurer.
// ============================================================

const webpush = require("web-push");
const { prisma } = require("./prisma");
const { obtenirInfosEntreprise } = require("./config");
const { image } = require("./client");

const CLE_PUBLIQUE = "vapid_cle_publique";
const CLE_PRIVEE = "vapid_cle_privee";

async function obtenirClesVapid() {
  const lignes = await prisma.parametre.findMany({ where: { cle: { in: [CLE_PUBLIQUE, CLE_PRIVEE] } } });
  const dict = Object.fromEntries(lignes.map((l) => [l.cle, l.valeur]));
  if (dict[CLE_PUBLIQUE] && dict[CLE_PRIVEE]) return { publique: dict[CLE_PUBLIQUE], privee: dict[CLE_PRIVEE] };

  const cles = webpush.generateVAPIDKeys();
  // Les deux clés vont ensemble : écrites dans une seule transaction, et si
  // une autre requête les a créées entre-temps, on garde les siennes
  try {
    await prisma.$transaction([
      prisma.parametre.create({ data: { cle: CLE_PUBLIQUE, valeur: cles.publicKey } }),
      prisma.parametre.create({ data: { cle: CLE_PRIVEE, valeur: cles.privateKey } }),
    ]);
    return { publique: cles.publicKey, privee: cles.privateKey };
  } catch {
    return obtenirClesVapid();
  }
}

async function clePubliqueVapid() {
  return (await obtenirClesVapid()).publique;
}

// Contact exigé par les services de notifications (Apple refuse un envoi
// sans adresse valide)
async function sujetVapid() {
  const { courriel } = await obtenirInfosEntreprise();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel || "") ? `mailto:${courriel}` : "mailto:info@sgwebsite.online";
}

// Envoie une notification à tous les appareils abonnés de l'employé.
// Retourne le nombre d'appareils atteints ; les abonnements expirés
// (désinstallé, notifications retirées) sont effacés au passage.
async function envoyerNotification(employeId, { titre, corps, url = "/mes-taches", tag }) {
  const abonnements = await prisma.abonnementPush.findMany({ where: { employeId } });
  if (abonnements.length === 0) return 0;

  const cles = await obtenirClesVapid();
  const options = { vapidDetails: { subject: await sujetVapid(), publicKey: cles.publique, privateKey: cles.privee }, TTL: 24 * 3600, urgency: "high" };
  const contenu = JSON.stringify({ titre, corps, url, tag, icone: image("icon-192.png") });

  let atteints = 0;
  for (const a of abonnements) {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, contenu, options);
      atteints++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await prisma.abonnementPush.delete({ where: { id: a.id } }).catch(() => {});
      else console.error("Notification non livrée :", e.statusCode || "", e.body || e.message);
    }
  }
  return atteints;
}

module.exports = { clePubliqueVapid, envoyerNotification };
