import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { dateHeureLocaleVersUTC } from "@/lib/temps";
import { verifierCreneau } from "@/lib/disponibilites";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { clientId, clientNom, clientTelephone, vehiculeInfo, note, date, dureeMinutes, motif, forcer } = await request.json();
  if (!clientNom || !date || !motif) {
    return NextResponse.json({ erreur: "Nom du client, date et motif requis." }, { status: 400 });
  }

  // Hors disponibilités : refusé, sauf si l'employé confirme vouloir le
  // placer quand même (forcer) — contrairement au site de réservation.
  const debut = dateHeureLocaleVersUTC(date);
  const duree = Number(dureeMinutes) || 60;
  if (!forcer) {
    const raison = await verifierCreneau(debut, duree);
    if (raison) return NextResponse.json({ erreur: raison, horsDisponibilite: true }, { status: 409 });
  }

  const rdv = await prisma.rendezVous.create({
    data: {
      clientId: clientId || null,
      clientNom,
      clientTelephone: clientTelephone || null,
      vehiculeInfo: vehiculeInfo || null,
      note: note || null,
      date: debut,
      dureeMinutes: duree,
      motif,
    },
  });

  return NextResponse.json(rdv);
}
