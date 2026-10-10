import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { TYPES_NOTIFICATIONS } from "@/lib/typesNotifications";

// Types d'avis que l'employé connecté ne veut plus recevoir — réservé à
// ceux qui ont la section « Notifications » ; les obligatoires (bon envoyé,
// message du gérant) ne se coupent pas
export async function PUT(request) {
  const session = await obtenirSession();
  if (!session || session.role === "DEVELOPPEUR") return NextResponse.json({ erreur: "Seul un compte employé a des préférences." }, { status: 403 });

  if (!(await aAccesSection(session, "notifications"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const { coupees } = await request.json().catch(() => ({}));
  if (!Array.isArray(coupees)) return NextResponse.json({ erreur: "Liste invalide." }, { status: 400 });
  const valides = [...new Set(coupees)].filter((t) => TYPES_NOTIFICATIONS[t] && !TYPES_NOTIFICATIONS[t].obligatoire);
  await prisma.user.update({ where: { id: session.id }, data: { notificationsCoupees: valides } });
  return NextResponse.json({ coupees: valides });
}
