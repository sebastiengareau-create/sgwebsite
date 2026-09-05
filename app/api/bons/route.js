import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const {
    clientId, clientNom, clientTelephone, clientAdresse, clientVille, clientCodePostal,
    vehiculeId, marque, modele, annee, vin, plaque,
    problemes,
  } = await request.json();

  const lignesValides = (problemes || []).map((p) => p.trim()).filter(Boolean);

  if ((!clientId && !clientNom) || (!vehiculeId && (!marque || !modele)) || lignesValides.length === 0) {
    return NextResponse.json({ erreur: "Champs manquants (au moins une tâche requise)." }, { status: 400 });
  }

  const vinPropre = (vin || "").trim().toUpperCase();
  if (vinPropre && vinPropre.length !== 17) {
    return NextResponse.json({ erreur: "Le NIV doit contenir exactement 17 caractères." }, { status: 400 });
  }

  let idClientFinal = clientId;

  if (!idClientFinal) {
    const doublon = await prisma.client.findFirst({
      where: { nom: { equals: clientNom.trim(), mode: "insensitive" } },
    });
    if (doublon) {
      return NextResponse.json(
        { erreur: `Un client nommé "${doublon.nom}" existe déjà — utilise la recherche pour le sélectionner plutôt que d'en créer un nouveau.` },
        { status: 409 }
      );
    }

    const client = await prisma.client.create({
      data: {
        nom: clientNom,
        telephone: clientTelephone || null,
        adresse: clientAdresse || null,
        ville: clientVille || null,
        codePostal: clientCodePostal || null,
      },
    });
    idClientFinal = client.id;
  } else {
    const existe = await prisma.client.findUnique({ where: { id: idClientFinal } });
    if (!existe) return NextResponse.json({ erreur: "Client introuvable." }, { status: 404 });
  }

  let idVehiculeFinal = vehiculeId;

  if (idVehiculeFinal) {
    const vehiculeExiste = await prisma.vehicule.findUnique({ where: { id: idVehiculeFinal } });
    if (!vehiculeExiste || vehiculeExiste.clientId !== idClientFinal) {
      return NextResponse.json({ erreur: "Véhicule introuvable pour ce client." }, { status: 404 });
    }
  } else {
    const vehicule = await prisma.vehicule.create({
      data: {
        marque, modele,
        annee: annee ? Number(annee) : null,
        vin: vinPropre || null,
        plaque: plaque || null,
        clientId: idClientFinal,
      },
    });
    idVehiculeFinal = vehicule.id;
  }

  const dernierBon = await prisma.bonTravail.findFirst({ orderBy: { numero: "desc" } });
  let prochainNum = 1;
  if (dernierBon) {
    const partieNum = parseInt(dernierBon.numero.split("-")[1], 10);
    if (!isNaN(partieNum)) prochainNum = partieNum + 1;
  }
  const numero = `2026-${String(1000 + prochainNum).slice(1)}`;

  const bon = await prisma.bonTravail.create({
    data: {
      numero,
      clientId: idClientFinal,
      vehiculeId: idVehiculeFinal,
      problemes: { create: lignesValides.map((description) => ({ description })) },
    },
  });

  return NextResponse.json({ id: bon.id, numero: bon.numero });
}
