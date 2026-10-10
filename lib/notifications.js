// ============================================================
// NOTIFICATIONS — cloche 🔔 de l'appli et téléphone (Web Push, gratuit)
// ============================================================
// notifier(type, …) : chaque avis est gardé dans la table Notification
// (cloche et page Notifications) et poussé sur les téléphones abonnés de
// chaque destinataire. Les raisons possibles et qui les reçoit : voir
// lib/typesNotifications.js.
//
// L'employé active son téléphone une fois (page Notifications) : son navigateur
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
const { TYPES_NOTIFICATIONS } = require("./typesNotifications");

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
async function envoyerNotification(employeId, { titre, corps, url = "/notifications", tag }) {
  const abonnements = await prisma.abonnementPush.findMany({ where: { employeId } });
  if (abonnements.length === 0) return 0;

  const cles = await obtenirClesVapid();
  const options = { vapidDetails: { subject: await sujetVapid(), publicKey: cles.publique, privateKey: cles.privee }, TTL: 24 * 3600, urgency: "high" };
  // Nombre de non lues : pastille sur l'icône de l'app (voir public/sw.js)
  const nonLues = await prisma.notification.count({ where: { employeId, lue: false } });
  const contenu = JSON.stringify({ titre, corps, url, tag, nonLues, icone: image("icon-192.png") });

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

// Module Notifications (Administrateur → Modules) : actif tant qu'il n'est
// pas désactivé. Désactivé, plus de cloche ni d'avis — sauf celui d'un bon
// envoyé, qui fait partie du module Jobs en déplacement.
async function notificationsActives() {
  const p = await prisma.parametre.findUnique({ where: { cle: "module_notifications" } });
  return p?.valeur !== "inactif";
}

// Rôles qui reçoivent ce type d'avis : choisis par le niveau 4 (Notifications
// → Qui reçoit quoi), sinon ceux par défaut du type
const cleRoles = (type) => `notif_roles_${type}`;
async function rolesDuType(type) {
  const t = TYPES_NOTIFICATIONS[type];
  if (!t?.parRole) return [];
  const p = await prisma.parametre.findUnique({ where: { cle: cleRoles(type) } });
  return p ? p.valeur.split(",").filter(Boolean) : t.rolesDefaut;
}

async function tousLesRolesParType() {
  const lignes = await prisma.parametre.findMany({ where: { cle: { startsWith: "notif_roles_" } } });
  const dict = Object.fromEntries(lignes.map((l) => [l.cle, l.valeur]));
  return Object.fromEntries(
    Object.entries(TYPES_NOTIFICATIONS)
      .filter(([, t]) => t.parRole)
      .map(([type, t]) => [type, dict[cleRoles(type)] !== undefined ? dict[cleRoles(type)].split(",").filter(Boolean) : t.rolesDefaut])
  );
}

async function enregistrerRolesDuType(type, roles) {
  await prisma.parametre.upsert({ where: { cle: cleRoles(type) }, update: { valeur: roles.join(",") }, create: { cle: cleRoles(type), valeur: roles.join(",") } });
}

// Employés concernés par un bon : ceux qui y ont du temps, et ceux à qui
// il a été envoyé (sauf envoi annulé)
async function employesDuBon(bonId) {
  const [temps, envois] = await Promise.all([
    prisma.entreeTemps.findMany({ where: { probleme: { bonId } }, select: { employeId: true }, distinct: ["employeId"] }),
    prisma.envoiBon.findMany({ where: { bonId, statut: { not: "ANNULE" } }, select: { employeId: true }, distinct: ["employeId"] }),
  ]);
  return [...new Set([...temps, ...envois].map((x) => x.employeId))];
}

// Avise les personnes concernées (employeIds) et les rôles choisis pour ce
// type, sauf ceux de sauf (souvent l'auteur du geste) et ceux qui l'ont
// coupé — seul le niveau 4 peut couper un type : les autres reçoivent tout
// ce qui leur est destiné, sans choix. Ne lance jamais d'erreur : un avis raté ne doit rien bloquer.
// Retourne { employeId: appareils atteints } pour chaque destinataire.
async function notifier(type, { employeIds = [], sauf = [], titre, corps, url, tag }) {
  const resultat = {};
  try {
    const t = TYPES_NOTIFICATIONS[type];
    if (!t) throw new Error(`type d'avis inconnu : ${type}`);
    if (type !== "BON_ENVOYE" && !(await notificationsActives())) return resultat;
    const roles = await rolesDuType(type);
    const ou = [];
    if (employeIds.length > 0) ou.push({ id: { in: employeIds } });
    if (roles.length > 0) ou.push({ role: { in: roles } });
    if (ou.length === 0) return resultat;

    const employes = await prisma.user.findMany({
      where: { actif: true, OR: ou, ...(sauf.length > 0 && { id: { notIn: sauf } }) },
      select: { id: true, role: true, notificationsCoupees: true },
    });
    const destinataires = employes.filter((e) => t.obligatoire || e.role !== "NIVEAU4" || !e.notificationsCoupees.includes(type));
    if (destinataires.length === 0) return resultat;

    const texte = corps ? String(corps).slice(0, 500) : null;
    await prisma.notification.createMany({
      data: destinataires.map((e) => ({ employeId: e.id, type, titre, corps: texte, url: url || null })),
    });
    await Promise.all(destinataires.map(async (e) => {
      resultat[e.id] = await envoyerNotification(e.id, { titre, corps: texte || "", url, tag });
    }));
  } catch (e) {
    console.error("Notification non envoyée :", e.message || e);
  }
  return resultat;
}

module.exports = { clePubliqueVapid, envoyerNotification, notifier, employesDuBon, notificationsActives, rolesDuType, tousLesRolesParType, enregistrerRolesDuType };
