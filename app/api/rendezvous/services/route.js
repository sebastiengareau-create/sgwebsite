import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { validerServiceWeb } from "@/lib/servicesWeb";

// Services offerts sur le site de réservation en ligne (Calendrier →
// Paramètres web), pour le serveur du site (même clé secrète que le
// webhook, en en-tête x-webhook-secret) ou un utilisateur ayant accès au
// calendrier.
//
//   GET /api/rendezvous/services
//   → { services: [{ id, nom, dureeMinutes }] }   (services actifs, par nom)
//
// Liste vide : aucun service n'a encore été entré dans le logiciel — le
// site garde alors sa propre liste.
export async function GET(request) {
  const cleRecue = request.headers.get("x-webhook-secret");
  const cleAttendue = process.env.GARAGE_BOOKING_WEBHOOK_SECRET;
  const parCle = !!cleAttendue && cleRecue === cleAttendue;
  if (!parCle) {
    const session = await obtenirSession();
    if (!(await aAccesSection(session, "calendrier"))) {
      return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
    }
  }

  const services = await prisma.serviceWeb.findMany({
    where: { actif: true },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true, dureeMinutes: true },
  });
  return NextResponse.json({ services });
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }
  const { data, erreur } = validerServiceWeb(await request.json());
  if (erreur) return NextResponse.json({ erreur }, { status: 400 });
  const service = await prisma.serviceWeb.create({ data });
  return NextResponse.json(service);
}
