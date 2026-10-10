import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { notificationsActives } from "@/lib/notifications";

// Dernières notifications de l'employé connecté (cloche 🔔) et le nombre
// de non lues
export async function GET() {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  if (session.role === "DEVELOPPEUR" || !(await notificationsActives())) return NextResponse.json({ notifications: [], nonLues: 0 });

  const [notifications, nonLues] = await Promise.all([
    prisma.notification.findMany({ where: { employeId: session.id }, orderBy: { creeLe: "desc" }, take: 30 }),
    prisma.notification.count({ where: { employeId: session.id, lue: false } }),
  ]);
  return NextResponse.json({ notifications, nonLues });
}
