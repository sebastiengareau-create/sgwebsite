import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { clientId, clientNom, clientTelephone, vehiculeInfo, date, dureeMinutes, motif } = await request.json();
  if (!clientNom || !date || !motif) {
    return NextResponse.json({ erreur: "Nom du client, date et motif requis." }, { status: 400 });
  }

  const rdv = await prisma.rendezVous.create({
    data: {
      clientId: clientId || null,
      clientNom,
      clientTelephone: clientTelephone || null,
      vehiculeInfo: vehiculeInfo || null,
      date: new Date(date),
      dureeMinutes: Number(dureeMinutes) || 60,
      motif,
    },
  });

  return NextResponse.json(rdv);
}
