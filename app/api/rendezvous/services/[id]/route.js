import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { validerServiceWeb } from "@/lib/servicesWeb";

// Modifie un service du site de réservation : nom, durée, ou actif (un
// service désactivé disparaît du site ; les rendez-vous déjà pris restent).
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { data, erreur } = validerServiceWeb(await request.json(), { partiel: true });
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  const service = await prisma.serviceWeb.update({ where: { id: params.id }, data }).catch(() => null);
  if (!service) return NextResponse.json({ erreur: "Service introuvable." }, { status: 404 });
  return NextResponse.json(service);
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  await prisma.serviceWeb.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
