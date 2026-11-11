import { NextResponse } from "next/server";
import { rattacherDepotsAuBon } from "@/lib/depots";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prochainNumeroBon, creerAvecNumero } from "@/lib/numerotation";
import { CLIENT } from "@/lib/client";
import { tachesRetenues } from "@/lib/approbationCalculs";
import { trouverBonsNonFactures } from "@/lib/bons";
import { clientEtVehiculeDuBon, sortDuStock, manqueStockSoumission, sortirPieceSoumissionDuStock, messagePieceSoumission } from "@/lib/soumissions";
import { messageBonsNonFactures } from "@/lib/bonsNonFactures";

export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const soumission = await prisma.soumission.findUnique({
    where: { id: params.id },
    include: { taches: { include: { pieces: true } }, vehicule: true },
  });
  if (!soumission) return NextResponse.json({ erreur: "Soumission introuvable." }, { status: 404 });
  // Approuvée en ligne par le client : seuls les travaux qu'il a cochés sont repris
  soumission.taches = tachesRetenues(soumission);
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

  // Pièces de l'inventaire de la soumission : c'est maintenant qu'elles
  // sortent du stock — vérifié avant de créer client, véhicule ou bon
  const manque = await manqueStockSoumission(soumission);
  if (manque) return NextResponse.json({ erreur: manque }, { status: 409 });

  // Client : réutilise celui déjà lié, sinon en crée un nouveau ; véhicule
  // du dossier, sinon le nouveau, versé au dossier du client
  const { clientId, vehiculeId, kilometrage, clientNomAffiche } = await clientEtVehiculeDuBon(soumission);
  const bon = await creerAvecNumero(prochainNumeroBon, (numero) => prisma.bonTravail.create({
    data: { numero, clientId, vehiculeId, kilometrage, clientNomAffiche },
    include: { client: true },
  }));

  // Le temps et les pièces en texte libre de la soumission n'étaient que des
  // estimés : seules les descriptions des tâches sont reprises, le vrai suivi
  // (temps, pièces réellement utilisées) démarre à zéro sur le bon. Les
  // pièces choisies dans l'inventaire, elles, passent sur leur tâche du bon
  // au prix de la soumission, et sortent du stock.
  try {
    await prisma.$transaction(async (tx) => {
      // Une à une, pour garder l'ordre des tâches
      for (const t of soumission.taches) {
        const probleme = await tx.probleme.create({ data: { bonId: bon.id, description: t.description } });
        for (const p of t.pieces.filter(sortDuStock)) {
          await sortirPieceSoumissionDuStock(tx, { probleme: { ...probleme, bon }, pieceEstimee: p, creePar: session.nom });
        }
      }
    }, { timeout: 30000 });
  } catch (e) {
    await prisma.bonTravail.delete({ where: { id: bon.id } });
    const message = messagePieceSoumission(e);
    if (message) return NextResponse.json({ erreur: message }, { status: 409 });
    throw e;
  }

  await prisma.$transaction(async (tx) => {
    await tx.soumission.update({
      where: { id: soumission.id },
      data: { statut: "ACCEPTEE", bonId: bon.id },
    });
    // Les dépôts de la soumission suivent le travail (lib/depots.js)
    await rattacherDepotsAuBon(tx, soumission.id, bon.id);
  });

  return NextResponse.json({ bonId: bon.id, bonNumero: bon.numero });
}
