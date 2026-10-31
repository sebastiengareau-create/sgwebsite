import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumeroBon, creerAvecNumero } from "@/lib/numerotation";
import { CLIENT } from "@/lib/client";
import { trouverBonsNonFactures } from "@/lib/bons";
import { clientEtVehiculeDuBon } from "@/lib/soumissions";
import { messageBonsNonFactures } from "@/lib/bonsNonFactures";

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const soumission = await prisma.soumission.findUnique({
    where: { id: params.id },
    include: { taches: true, vehicule: true },
  });
  if (!soumission) return NextResponse.json({ erreur: "Soumission introuvable." }, { status: 404 });
  // Profil soumissionFacturerDirect : une soumission se facture, elle ne
  // devient pas un bon à suivre
  if (CLIENT.soumissionFacturerDirect) {
    return NextResponse.json({ erreur: "Les soumissions se facturent directement (bouton « Facturé »)." }, { status: 409 });
  }
  if (soumission.bonId) {
    return NextResponse.json({ erreur: "Cette soumission a déjà été transformée en bon." }, { status: 409 });
  }

  // Profil avertirBonNonFacture : le client a déjà un bon pas encore
  // facturé — créer seulement si l'utilisateur le confirme
  const { confirmerBonNonFacture } = await request.json().catch(() => ({}));
  if (CLIENT.avertirBonNonFacture && !confirmerBonNonFacture) {
    const bons = await trouverBonsNonFactures({ clientId: soumission.clientId, nom: soumission.clientNom, telephone: soumission.clientTelephone });
    if (bons.length) {
      return NextResponse.json({ erreur: messageBonsNonFactures(soumission.clientNom, bons, soumission.clientId), bonNonFacture: true }, { status: 409 });
    }
  }

  // Client : réutilise celui déjà lié, sinon en crée un nouveau ; véhicule
  // du dossier, sinon le nouveau, versé au dossier du client
  const { clientId, vehiculeId, kilometrage } = await clientEtVehiculeDuBon(soumission);
  const bon = await creerAvecNumero(prochainNumeroBon, (numero) => prisma.bonTravail.create({
    data: {
      numero,
      clientId,
      vehiculeId,
      kilometrage,
      // Les pièces et le temps de la soumission n'étaient que des estimés —
      // seules les descriptions des tâches sont reprises ; le vrai suivi
      // (temps, pièces réellement utilisées) démarre à zéro sur le bon.
      problemes: { create: soumission.taches.map((t) => ({ description: t.description })) },
    },
  }));

  await prisma.soumission.update({
    where: { id: soumission.id },
    data: { statut: "ACCEPTEE", bonId: bon.id },
  });

  return NextResponse.json({ bonId: bon.id, bonNumero: bon.numero });
}
