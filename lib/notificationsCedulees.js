// Notifications cédulées : un rappel envoyé tout seul à l'heure choisie
// (ex. début et fin du break ou du dîner), chaque jour, du lundi au
// vendredi, certains jours ou une seule fois, à toute l'équipe, à des rôles
// ou à des employés précis. Créées dans la page Notifications (section
// « Notifications »). Heures du Québec.
//
// Le planificateur (lib/planificateurSauvegarde.js) appelle
// verifierNotificationsCedulees() chaque minute, mais la base n'est lue
// qu'à l'heure de la prochaine notification, gardée en mémoire — et de
// nouveau dès qu'une notification cédulée est ajoutée, modifiée ou
// supprimée (oublierProchaineCedulee). Sans notification active, aucune
// requête entre-temps : le serveur peut dormir sur Railway.
const { prisma } = require("./prisma");
const { notifier, notificationsActives } = require("./notifications");
const { dateAujourdhuiQuebec, jourSemaineQuebec, dateHeureQuebecVersUTC, FUSEAU } = require("./temps");
const { FREQUENCES_CEDULEES, JOURS_SEMAINE } = require("./typesNotifications");

// Serveur arrêté à l'heure prévue (redémarrage, mise à jour) : le rappel part
// quand même s'il n'a pas plus de 15 minutes de retard, sinon il est sauté
const RETARD_MAX_MINUTES = 15;
// Relecture de la base au moins aux 6 heures, au cas où elle aurait changé
// autrement que par cette instance du serveur
const RELECTURE_MAX_MS = 6 * 3600 * 1000;

const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function maintenantQuebec() {
  const maintenant = new Date();
  const heure = new Intl.DateTimeFormat("en-GB", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(maintenant);
  return { date: dateAujourdhuiQuebec(), heure, jour: jourSemaineQuebec(maintenant) };
}

function prevueCeJour(c, date, jour) {
  if (c.frequence === "QUOTIDIEN") return true;
  if (c.frequence === "SEMAINE") return !["sam", "dim"].includes(jour);
  if (c.frequence === "JOURS") return c.jours.includes(jour);
  if (c.frequence === "UNE_FOIS") return c.date === date;
  return false;
}

// Valide ce qui arrive du formulaire — { donnees } ou { erreur }.
// rolesValides : ROLES_VALIDES de lib/auth.js (pas importé ici : ce fichier
// roule aussi dans le planificateur, hors d'une requête)
function validerCedulee(corps, rolesValides) {
  const titre = String(corps?.titre || "").trim().slice(0, 80);
  const message = String(corps?.message || "").trim().slice(0, 500) || null;
  const heure = String(corps?.heure || "");
  const frequence = String(corps?.frequence || "");
  if (!titre) return { erreur: "Écris le titre de la notification." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) return { erreur: "Heure invalide." };
  if (!FREQUENCES_CEDULEES[frequence]) return { erreur: "Fréquence invalide." };

  const jours = frequence === "JOURS" && Array.isArray(corps.jours) ? Object.keys(JOURS_SEMAINE).filter((j) => corps.jours.includes(j)) : [];
  if (frequence === "JOURS" && jours.length === 0) return { erreur: "Choisis au moins un jour." };
  const date = frequence === "UNE_FOIS" ? String(corps.date || "") : null;
  if (frequence === "UNE_FOIS" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: "Choisis la date." };

  const tous = Boolean(corps.tous);
  const roles = !tous && Array.isArray(corps.roles) ? [...new Set(corps.roles)].filter((r) => rolesValides.includes(r)) : [];
  const employeIds = !tous && Array.isArray(corps.employeIds) ? [...new Set(corps.employeIds.map(String))] : [];
  if (!tous && roles.length === 0 && employeIds.length === 0) return { erreur: "Choisis au moins un destinataire." };

  return { donnees: { titre, message, heure, frequence, jours, date, tous, roles, employeIds, dernierEnvoi: dernierEnvoiDepart(heure) } };
}

// À l'enregistrement ou à la réactivation, une heure déjà passée aujourd'hui
// ne part pas tout de suite : la première fois sera la prochaine occurrence
function dernierEnvoiDepart(heure) {
  const maintenant = maintenantQuebec();
  return heure <= maintenant.heure ? maintenant.date : null;
}

async function destinatairesDe(c) {
  const employes = await prisma.user.findMany({
    where: { actif: true, ...(!c.tous && { OR: [{ role: { in: c.roles } }, { id: { in: c.employeIds } }] }) },
    select: { id: true },
  });
  return employes.map((e) => e.id);
}

async function envoyerNotificationsCedulees() {
  if (!(await notificationsActives())) return;
  const { date, heure, jour } = maintenantQuebec();
  const pasEncoreAujourdhui = [{ dernierEnvoi: null }, { dernierEnvoi: { not: date } }];
  const dues = await prisma.notificationCedulee.findMany({ where: { actif: true, heure: { lte: heure }, OR: pasEncoreAujourdhui } });

  for (const c of dues) {
    if (!prevueCeJour(c, date, jour) || minutes(heure) - minutes(c.heure) > RETARD_MAX_MINUTES) continue;
    // Réservée avant l'envoi : si deux serveurs vérifient en même temps, un
    // seul l'envoie
    const reservee = await prisma.notificationCedulee.updateMany({
      where: { id: c.id, actif: true, OR: pasEncoreAujourdhui },
      data: { dernierEnvoi: date, ...(c.frequence === "UNE_FOIS" && { actif: false }) },
    });
    if (reservee.count === 0) continue;

    const employeIds = await destinatairesDe(c);
    if (employeIds.length > 0) await notifier("RAPPEL_CEDULE", { employeIds, titre: `⏰ ${c.titre}`, corps: c.message, tag: `cedulee-${c.id}` });
  }
}

// Instant de la prochaine lecture de la base. Gardé sur globalThis : les
// routes API et le planificateur ne partagent pas les mêmes modules dans
// Next.js, mais bien le même processus. null = à relire tout de suite.
const PROCHAINE = Symbol.for("sgwebsite.prochaineCedulee");
const oublierProchaineCedulee = () => { globalThis[PROCHAINE] = null; };

// Prochain instant où une notification active est due, sur les 8 prochains
// jours (une semaine couvre toutes les fréquences)
async function calculerProchaine() {
  const maintenant = Date.now();
  const actives = await prisma.notificationCedulee.findMany({
    where: { actif: true },
    select: { heure: true, frequence: true, jours: true, date: true, dernierEnvoi: true },
  });
  const [an, mois, jour] = dateAujourdhuiQuebec().split("-").map(Number);
  let prochaine = maintenant + RELECTURE_MAX_MS;
  for (let d = 0; d < 8; d++) {
    const jourUTC = new Date(Date.UTC(an, mois - 1, jour + d));
    const date = jourUTC.toISOString().slice(0, 10);
    const jourSemaine = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"][jourUTC.getUTCDay()];
    for (const c of actives) {
      if (c.dernierEnvoi === date || !prevueCeJour(c, date, jourSemaine)) continue;
      const instant = dateHeureQuebecVersUTC(date, c.heure).getTime();
      if (instant + RETARD_MAX_MINUTES * 60 * 1000 < maintenant) continue;
      prochaine = Math.min(prochaine, Math.max(instant, maintenant));
    }
  }
  return prochaine;
}

async function verifierNotificationsCedulees() {
  const prochaine = globalThis[PROCHAINE];
  if (prochaine != null && Date.now() < prochaine) return;
  await envoyerNotificationsCedulees();
  globalThis[PROCHAINE] = await calculerProchaine();
}

module.exports = { validerCedulee, dernierEnvoiDepart, verifierNotificationsCedulees, oublierProchaineCedulee };
