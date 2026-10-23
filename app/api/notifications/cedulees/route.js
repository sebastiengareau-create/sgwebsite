import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection, ROLES_VALIDES } from "@/lib/auth";
import { notificationsActives } from "@/lib/notifications";
import { validerCedulee, oublierProchaineCedulee } from "@/lib/notificationsCedulees";

// Ajoute une notification cédulée (section « Notifications ») —
// { titre, message, heure, frequence, jours, date, tous, roles, employeIds }
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "notifications"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if (!(await notificationsActives())) return NextResponse.json({ erreur: "Le module Notifications est désactivé." }, { status: 403 });

  const { donnees, erreur } = validerCedulee(await request.json().catch(() => ({})), ROLES_VALIDES);
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  const cedulee = await prisma.notificationCedulee.create({ data: donnees });
  oublierProchaineCedulee();
  return NextResponse.json({ cedulee });
}
