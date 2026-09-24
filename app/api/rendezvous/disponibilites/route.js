import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { calculerCreneaux } from "@/lib/disponibilites";
import { dateAujourdhuiQuebec } from "@/lib/temps";

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Cases horaires réservables, pour le site de réservation en ligne (même
// clé secrète que le webhook, en en-tête x-webhook-secret — à appeler depuis
// le serveur du site, jamais depuis le navigateur du client) ou pour un
// utilisateur connecté ayant accès au calendrier.
//
//   GET /api/rendezvous/disponibilites?debut=2026-10-01&fin=2026-10-07&duree=60
//   → { intervalleMinutes, jours: [{ date, ferme, ouverture, fermeture, creneaux: ["08:00", …] }] }
//
// Les heures sont en heure du Québec ; réserver ensuite avec le webhook
// (date + time), qui revérifie que la case est toujours libre.
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

  const moduleCalendrier = await prisma.parametre.findUnique({ where: { cle: "module_calendrier" } });
  if (moduleCalendrier?.valeur === "inactif") {
    return NextResponse.json({ erreur: "Module Calendrier désactivé sur cette installation." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const debutStr = params.get("debut") || dateAujourdhuiQuebec();
  const finStr = params.get("fin") || debutStr;
  const duree = Number(params.get("duree") || 60);
  if (!FORMAT_DATE.test(debutStr) || !FORMAT_DATE.test(finStr) || finStr < debutStr) {
    return NextResponse.json({ erreur: "Dates invalides (format AAAA-MM-JJ, fin ≥ début)." }, { status: 400 });
  }
  if (!Number.isInteger(duree) || duree < 15 || duree > 600) {
    return NextResponse.json({ erreur: "Durée invalide (15 à 600 minutes)." }, { status: 400 });
  }

  const { reglages, jours } = await calculerCreneaux({ debutStr, finStr, dureeMinutes: duree });
  return NextResponse.json({ intervalleMinutes: reglages.intervalleMinutes, dureeMinutes: duree, jours });
}
