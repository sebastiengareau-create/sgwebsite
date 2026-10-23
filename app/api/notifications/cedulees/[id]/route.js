import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection, ROLES_VALIDES } from "@/lib/auth";
import { notificationsActives } from "@/lib/notifications";
import { validerCedulee, dernierEnvoiDepart, oublierProchaineCedulee } from "@/lib/notificationsCedulees";

async function refus(session) {
  if (!(await aAccesSection(session, "notifications"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if (!(await notificationsActives())) return NextResponse.json({ erreur: "Le module Notifications est désactivé." }, { status: 403 });
  return null;
}

// Modifie une notification cédulée : tout le formulaire, ou seulement
// { actif } pour la mettre en pause ou la réactiver
export async function PUT(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const r = await refus(session);
  if (r) return r;
  const existante = await prisma.notificationCedulee.findUnique({ where: { id: params.id } });
  if (!existante) return NextResponse.json({ erreur: "Notification introuvable." }, { status: 404 });

  const corps = await request.json().catch(() => ({}));
  let data;
  if (Object.keys(corps).length === 1 && typeof corps.actif === "boolean") {
    data = { actif: corps.actif, ...(corps.actif && !existante.actif && { dernierEnvoi: dernierEnvoiDepart(existante.heure) }) };
  } else {
    const { donnees, erreur } = validerCedulee(corps, ROLES_VALIDES);
    if (erreur) return NextResponse.json({ erreur }, { status: 400 });
    data = { ...donnees, actif: true };
  }
  const cedulee = await prisma.notificationCedulee.update({ where: { id: existante.id }, data });
  oublierProchaineCedulee();
  return NextResponse.json({ cedulee });
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  const r = await refus(session);
  if (r) return r;
  await prisma.notificationCedulee.deleteMany({ where: { id: params.id } });
  oublierProchaineCedulee();
  return NextResponse.json({ ok: true });
}
