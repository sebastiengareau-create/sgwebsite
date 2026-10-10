import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection, estNiveauMaxOuDev, nomAffichageRole, ROLES_VALIDES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clePubliqueVapid, tousLesRolesParType, notificationsActives } from "@/lib/notifications";
import EnTete from "../components/EnTete";
import NotificationsClient from "./NotificationsClient";

// Notifications : historique et activation sur le téléphone de l'employé
// connecté. Avec la section « Notifications » (Administrateur → Rôles et
// accès, gérant par défaut) : l'envoi d'un message. Niveau 4 seulement :
// ses préférences et le choix de qui reçoit quoi (voir lib/typesNotifications.js)
export default async function Notifications() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await notificationsActives())) redirect("/");
  const estEmploye = session.role !== "DEVELOPPEUR";
  const peutEnvoyer = await aAccesSection(session, "notifications");
  const peutRegler = estNiveauMaxOuDev(session);

  const [notifications, moi] = estEmploye
    ? await Promise.all([
      prisma.notification.findMany({ where: { employeId: session.id }, orderBy: { creeLe: "desc" }, take: 100 }),
      prisma.user.findUnique({ where: { id: session.id }, select: { notificationsCoupees: true } }),
    ])
    : [[], null];

  let gestion = null;
  if (peutEnvoyer || peutRegler) {
    const [rolesParType, employes, nomsRoles] = await Promise.all([
      tousLesRolesParType(),
      prisma.user.findMany({ where: { actif: true }, select: { id: true, nom: true, role: true }, orderBy: { nom: "asc" } }),
      Promise.all(ROLES_VALIDES.map(async (r) => ({ cle: r, nom: await nomAffichageRole(r) }))),
    ]);
    gestion = { rolesParType, employes: employes.filter((e) => e.id !== session.id), roles: nomsRoles, peutEnvoyer, peutRegler };
  }

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <NotificationsClient
        estEmploye={estEmploye}
        notificationsInitiales={notifications}
        coupeesInitiales={moi?.notificationsCoupees || []}
        clePublique={estEmploye ? await clePubliqueVapid() : null}
        gestion={gestion}
      />
    </div>
  );
}
