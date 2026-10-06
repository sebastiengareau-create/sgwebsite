import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumeroClient } from "@/lib/numerotation";
import { normaliserVehicule } from "@/lib/vehicules";
import { trouverDoublonsClient, messageDoublons } from "@/lib/clients";
import { normaliserProvince, normaliserCodePostal } from "@/lib/adresse";

export async function GET() {
  const session = await obtenirSession();
  // Coordonnées des clients : réservé à qui a accès à la section Clients
  if (!(await aAccesSection(session, "clients"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const clients = await prisma.client.findMany({ orderBy: { nom: "asc" } });
  return NextResponse.json(clients);
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { nom, telephone, courriel, adresse, ville, province, codePostal, garantieProlongee, vehicule, confirmerDoublon } = await request.json();
  if (!nom) return NextResponse.json({ erreur: "Le nom est requis." }, { status: 400 });

  // Premier véhicule du dossier, optionnel — ignoré s'il est laissé vide
  const vehiculeNormalise = normaliserVehicule(vehicule);
  if (vehiculeNormalise.erreur) return NextResponse.json({ erreur: vehiculeNormalise.erreur }, { status: 400 });

  // Homonymes permis : on avertit (même nom, téléphone ou courriel) et
  // l'utilisateur confirme s'il s'agit bien d'une autre personne.
  if (!confirmerDoublon) {
    const doublons = await trouverDoublonsClient({ nom, telephone, courriel });
    if (doublons.length > 0) {
      return NextResponse.json({ erreur: messageDoublons(doublons), doublonPossible: true }, { status: 409 });
    }
  }

  const client = await prisma.client.create({
    data: {
      numero: await prochainNumeroClient(),
      nom,
      telephone: telephone || null,
      courriel: courriel || null,
      adresse: adresse || null,
      ville: ville || null,
      province: normaliserProvince(province),
      codePostal: normaliserCodePostal(codePostal),
      garantieProlongee: garantieProlongee || null,
      vehicules: vehiculeNormalise.vide ? undefined : { create: vehiculeNormalise.data },
    },
  });
  return NextResponse.json(client);
}
