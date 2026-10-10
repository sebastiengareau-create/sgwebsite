import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection, ROLES_VALIDES } from "@/lib/auth";
import { notifier, notificationsActives } from "@/lib/notifications";

// Message envoyé à la main (section « Notifications », gérant par défaut) : à toute l'équipe, à des rôles ou
// à des employés précis — { message, tous, roles: [...], employeIds: [...] }
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "notifications"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if (!(await notificationsActives())) return NextResponse.json({ erreur: "Le module Notifications est désactivé." }, { status: 403 });

  const { message, tous, roles = [], employeIds = [] } = await request.json().catch(() => ({}));
  const texte = String(message || "").trim().slice(0, 500);
  if (!texte) return NextResponse.json({ erreur: "Écris un message." }, { status: 400 });

  const rolesValides = Array.isArray(roles) ? roles.filter((r) => ROLES_VALIDES.includes(r)) : [];
  const ids = Array.isArray(employeIds) ? employeIds.map(String) : [];
  const destinataires = await prisma.user.findMany({
    where: { actif: true, ...(!tous && { OR: [{ role: { in: rolesValides } }, { id: { in: ids } }] }) },
    select: { id: true },
  });
  const cibles = destinataires.map((d) => d.id).filter((id) => id !== session.id);
  if (cibles.length === 0) return NextResponse.json({ erreur: "Choisis au moins un destinataire." }, { status: 400 });

  const atteints = await notifier("MESSAGE", { employeIds: cibles, titre: `📣 Message de ${session.nom}`, corps: texte });
  return NextResponse.json({ destinataires: cibles.length, telephones: Object.values(atteints).filter((n) => n > 0).length });
}
