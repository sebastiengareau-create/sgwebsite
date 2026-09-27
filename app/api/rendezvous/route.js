import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { dateHeureLocaleVersUTC } from "@/lib/temps";
import { verifierCreneau } from "@/lib/disponibilites";
import { normaliserVehicule, libelleVehicule } from "@/lib/vehicules";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { clientId, clientNom, clientTelephone, vehiculeInfo, vehiculeId, vehicule, note, date, dureeMinutes, motif, forcer } = await request.json();
  if (!clientNom || !date || !motif) {
    return NextResponse.json({ erreur: "Nom du client, date et motif requis." }, { status: 400 });
  }

  // Véhicule : un véhicule du dossier du client, ou les champs du formulaire
  // (année, marque, modèle, version, NIV, plaque). Gardé dans vehiculeDetails
  // — il rejoint le dossier du client à la conversion en bon.
  let vehiculeDetails = null;
  if (vehiculeId) {
    const existant = await prisma.vehicule.findFirst({ where: { id: vehiculeId, clientId: clientId || undefined } });
    if (!existant) return NextResponse.json({ erreur: "Véhicule introuvable dans le dossier du client." }, { status: 400 });
    vehiculeDetails = normaliserVehicule(existant).data;
  } else if (vehicule) {
    const { data, vide, erreur } = normaliserVehicule(vehicule);
    if (erreur) return NextResponse.json({ erreur }, { status: 400 });
    if (!vide) vehiculeDetails = data;
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
      vehiculeInfo: (vehiculeDetails && libelleVehicule(vehiculeDetails)) || vehiculeInfo || null,
      vehiculeDetails: vehiculeDetails || undefined,
      note: note || null,
      date: debut,
      dureeMinutes: duree,
      motif,
    },
  });

  return NextResponse.json(rdv);
}
