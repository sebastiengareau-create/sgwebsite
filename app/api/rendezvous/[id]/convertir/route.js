import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumeroClient, prochainNumeroBon, creerAvecNumero } from "@/lib/numerotation";
import { verserVehiculeAuDossier } from "@/lib/clients";
import { CLIENT } from "@/lib/client";
import { trouverBonsNonFactures } from "@/lib/bons";
import { messageBonsNonFactures } from "@/lib/bonsNonFactures";
import { provinceDuCodePostal, normaliserCodePostal } from "@/lib/adresse";

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const rdv = await prisma.rendezVous.findUnique({ where: { id: params.id } });
  if (!rdv) return NextResponse.json({ erreur: "Rendez-vous introuvable." }, { status: 404 });
  if (rdv.bonId) return NextResponse.json({ erreur: "Déjà transformé en bon." }, { status: 409 });

  // Profil avertirBonNonFacture : le client a déjà un bon pas encore
  // facturé — créer seulement si l'utilisateur le confirme
  const { confirmerBonNonFacture } = await request.json().catch(() => ({}));
  if (CLIENT.avertirBonNonFacture && !confirmerBonNonFacture) {
    const bons = await trouverBonsNonFactures({ clientId: rdv.clientId, nom: rdv.clientNom, telephone: rdv.clientTelephone, courriel: rdv.clientCourriel });
    if (bons.length) {
      return NextResponse.json({ erreur: messageBonsNonFactures(rdv.clientNom, bons, rdv.clientId), bonNonFacture: true }, { status: 409 });
    }
  }

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
        // La prise de rendez-vous en ligne ne demande pas la province
        province: provinceDuCodePostal(rdv.clientCodePostal),
        codePostal: normaliserCodePostal(rdv.clientCodePostal),
      },
    });
    clientId = client.id;
  }

  // Véhicule du rendez-vous (site de réservation ou calendrier) → versé au
  // dossier du client, sans doublon si ce véhicule y est déjà
  const vehiculeId = await verserVehiculeAuDossier(clientId, rdv.vehiculeDetails);

  // Le bon reste « En attente » jusqu'au premier poinçon, planifié à la date
  // du rendez-vous — un rendez-vous à venir apparaît sous sa journée prévue.
  const bon = await creerAvecNumero(prochainNumeroBon, (numero) => prisma.bonTravail.create({
    data: {
      numero,
      statut: "EN_ATTENTE",
      datePrevue: rdv.date,
      clientId,
      vehiculeId,
      // Le service réservé, puis chaque tâche demandée : une ligne du bon chacune
      problemes: { create: [rdv.motif, ...(rdv.taches || [])].map((description) => ({ description })) },
    },
  }));

  await prisma.rendezVous.update({ where: { id: rdv.id }, data: { statut: "COMPLETE", bonId: bon.id } });

  return NextResponse.json({ bonId: bon.id, bonNumero: bon.numero });
}
