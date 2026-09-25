import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumeroClient } from "@/lib/numerotation";
import { normaliserVehicule } from "@/lib/vehicules";

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const rdv = await prisma.rendezVous.findUnique({ where: { id: params.id } });
  if (!rdv) return NextResponse.json({ erreur: "Rendez-vous introuvable." }, { status: 404 });
  if (rdv.bonId) return NextResponse.json({ erreur: "Déjà transformé en bon." }, { status: 409 });

  let clientId = rdv.clientId;
  if (!clientId) {
    const client = await prisma.client.create({
      data: {
        numero: await prochainNumeroClient(),
        nom: rdv.clientNom,
        telephone: rdv.clientTelephone || null,
        courriel: rdv.clientCourriel || null,
        adresse: rdv.clientAdresse || null,
        ville: rdv.clientVille || null,
        codePostal: rdv.clientCodePostal || null,
      },
    });
    clientId = client.id;
  }

  // Véhicule reçu du site de réservation → versé au dossier du client, sans
  // doublon si ce véhicule (même NIV ou même plaque) y est déjà.
  let vehiculeId = null;
  const { data: vehicule, vide } = normaliserVehicule(rdv.vehiculeDetails);
  if (vehicule && !vide) {
    const identifiants = [vehicule.niv && { niv: vehicule.niv }, vehicule.plaque && { plaque: vehicule.plaque }].filter(Boolean);
    const existant = identifiants.length
      ? await prisma.vehicule.findFirst({ where: { clientId, OR: identifiants } })
      : null;
    vehiculeId = existant?.id || (await prisma.vehicule.create({ data: { ...vehicule, clientId } })).id;
  }

  const dernierBon = await prisma.bonTravail.findFirst({ orderBy: { numero: "desc" } });
  let prochainNum = 1;
  if (dernierBon) {
    const partieNum = parseInt(dernierBon.numero.split("-")[1], 10);
    if (!isNaN(partieNum)) prochainNum = partieNum + 1;
  }
  const numero = `2026-${String(1000 + prochainNum).slice(1)}`;

  // Le bon reste « En attente » jusqu'au premier poinçon, planifié à la date
  // du rendez-vous — un rendez-vous à venir apparaît sous sa journée prévue.
  const bon = await prisma.bonTravail.create({
    data: {
      numero,
      statut: "EN_ATTENTE",
      datePrevue: rdv.date,
      clientId,
      vehiculeId,
      problemes: { create: [{ description: rdv.motif }] },
    },
  });

  await prisma.rendezVous.update({ where: { id: rdv.id }, data: { statut: "COMPLETE", bonId: bon.id } });

  return NextResponse.json({ bonId: bon.id, bonNumero: bon.numero });
}
