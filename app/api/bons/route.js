import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumeroClient } from "@/lib/numerotation";
import { dateHeureLocaleVersUTC } from "@/lib/temps";
import { verifierCreneau } from "@/lib/disponibilites";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const {
    clientId, clientNom, clientTelephone, clientAdresse, clientVille, clientCodePostal,
    problemes, datePrevue, ajouterAuCalendrier, dureeMinutes, forcer,
  } = await request.json();

  const lignesValides = (problemes || []).map((p) => p.trim()).filter(Boolean);

  if ((!clientId && !clientNom) || lignesValides.length === 0) {
    return NextResponse.json({ erreur: "Champs manquants (au moins une tâche requise)." }, { status: 400 });
  }

  // Le bon s'inscrit aussi au calendrier (rendez-vous « BON ») à sa date
  // prévue. Même règle que pour un rendez-vous entré au calendrier : hors
  // disponibilités ou créneau complet, on demande confirmation (forcer).
  const debutPrevu = datePrevue ? dateHeureLocaleVersUTC(datePrevue) : null;
  const duree = Math.max(15, Number(dureeMinutes) || 60);
  const inscrireCalendrier = !!ajouterAuCalendrier && !!debutPrevu;
  if (inscrireCalendrier && !forcer) {
    const raison = await verifierCreneau(debutPrevu, duree);
    if (raison) return NextResponse.json({ erreur: raison, horsDisponibilite: true }, { status: 409 });
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
        numero: await prochainNumeroClient(),
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

  const dernierBon = await prisma.bonTravail.findFirst({ orderBy: { numero: "desc" } });
  let prochainNum = 1;
  if (dernierBon) {
    const partieNum = parseInt(dernierBon.numero.split("-")[1], 10);
    if (!isNaN(partieNum)) prochainNum = partieNum + 1;
  }
  const numero = `2026-${String(1000 + prochainNum).slice(1)}`;

  const client = await prisma.client.findUnique({ where: { id: idClientFinal } });
  const bon = await prisma.bonTravail.create({
    data: {
      numero,
      clientId: idClientFinal,
      datePrevue: debutPrevu,
      problemes: { create: lignesValides.map((description) => ({ description })) },
      rendezVous: inscrireCalendrier
        ? {
            create: {
              clientId: idClientFinal,
              clientNom: client.nom,
              clientTelephone: client.telephone || null,
              date: debutPrevu,
              dureeMinutes: duree,
              motif: lignesValides.join(", "),
              source: "BON",
            },
          }
        : undefined,
    },
  });

  return NextResponse.json({ id: bon.id, numero: bon.numero });
}
