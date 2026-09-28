import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { validerServiceWeb } from "@/lib/servicesWeb";
import { chargerSymptomes, symptomesPourSite } from "@/lib/symptomesWeb";

// Services offerts sur le site de réservation en ligne (Calendrier →
// Paramètres web), pour le serveur du site (même clé secrète que le
// webhook, en en-tête x-webhook-secret) ou un utilisateur ayant accès au
// calendrier.
//
//   GET /api/rendezvous/services
//   → { services: [{ id, type: "service", nom, description, dureeMinutes }, …,
//                  { id: "symptomes", type: "symptomes", nom, description, dureeMinutes,
//                    voyants: [{ id, nom, icone }], symptomes: ["Bruit", …] }] }
//
// Services actifs par nom (description : courte ligne à afficher sous le
// nom, en plus petit et en italique ; null si aucune), puis — toujours en
// dernier, si elle est activée — l'option « Dites-nous les symptômes » :
// le client y coche les voyants allumés (icone : lien vers l'image) et les
// symptômes, renvoyés au webhook (warning_lights, symptoms).
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

  const [services, symptomes] = await Promise.all([
    prisma.serviceWeb.findMany({
      where: { actif: true },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, description: true, dureeMinutes: true },
    }),
    chargerSymptomes(prisma),
  ]);
  const liste = services.map((s) => ({ ...s, type: "service" }));
  if (liste.length && symptomes.actif) liste.push(symptomesPourSite(symptomes, adresseLogiciel(request)));
  return NextResponse.json({ services: liste });
}

// Adresse publique du logiciel (derrière le proxy de Railway), pour les
// liens des icônes de voyants.
function adresseLogiciel(request) {
  const url = new URL(request.url);
  const hote = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const protocole = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return `${protocole}://${hote}`;
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
