import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { verifierPeriodeModifiable } from "@/lib/comptabilite";
import { enregistrerPaiements, retirerPaiements, soldeFacture } from "@/lib/paiementsFactures";
import { erreurPourReponse } from "@/lib/transactionsBancaires";
import { MODE_PAIEMENT_COUTANT } from "@/lib/vehiculesAVendre";

// Changement de statut. « PAYEE » encaisse le solde en un seul paiement
// (les paiements multiples passent par ./paiements) ; « IMPAYEE » retire
// tous les paiements et leurs écritures.
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { statut, compteTresorerieId, modePaiement, reference } = await request.json();
  if (!["IMPAYEE", "PAYEE", "ANNULEE"].includes(statut)) {
    return NextResponse.json({ erreur: "Statut invalide." }, { status: 400 });
  }

  const ancienneFacture = await prisma.facture.findUnique({ where: { id: params.id } });
  if (!ancienneFacture) return NextResponse.json({ erreur: "Facture introuvable." }, { status: 404 });
  if (ancienneFacture.modePaiement === MODE_PAIEMENT_COUTANT) {
    return NextResponse.json({ erreur: "Cette facture est payée par le coûtant du véhicule à vendre — son statut ne se change pas." }, { status: 409 });
  }

  try {
    if (statut === "PAYEE") {
      if (!compteTresorerieId) return NextResponse.json({ erreur: "Choisis un compte pour l'encaissement." }, { status: 400 });
      const { facture, avertissementComptable } = await enregistrerPaiements(
        params.id, [{ montant: soldeFacture(ancienneFacture), modePaiement, compteTresorerieId, reference }], { creePar: session.nom }
      );
      return NextResponse.json({ ...facture, avertissementComptable });
    }
    if (statut === "ANNULEE" && ancienneFacture.montantPaye > 0) {
      return NextResponse.json({ erreur: "Retire d'abord les paiements reçus sur cette facture." }, { status: 409 });
    }
    let facture = await retirerPaiements(params.id);
    if (statut === "ANNULEE") facture = await prisma.facture.update({ where: { id: params.id }, data: { statut } });
    return NextResponse.json(facture);
  } catch (e) {
    const { erreur, status } = erreurPourReponse(e);
    return NextResponse.json({ erreur }, { status });
  }
}

export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  // Restreint au gérant seulement — suppression définitive, pensée pour
  // nettoyer des factures de test, pas pour un usage courant une fois en
  // production réelle.
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Seul le gérant peut supprimer une facture." }, { status: 403 });
  }

  const facture = await prisma.facture.findUnique({ where: { id: params.id }, include: { bon: { select: { vehiculeVente: { select: { numero: true, factureVente: { select: { id: true } } } } } } } });
  if (!facture) return NextResponse.json({ erreur: "Facture introuvable." }, { status: 404 });
  // Bon d'un véhicule à vendre déjà vendu : son montant est compris dans le
  // coûtant figé sur la facture de vente
  if (facture.bon.vehiculeVente?.factureVente) {
    return NextResponse.json({ erreur: `Le véhicule ${facture.bon.vehiculeVente.numero} est vendu — annule d'abord sa facture de vente.` }, { status: 409 });
  }

  try {
    await verifierPeriodeModifiable(facture.dateEmission, { nouvellePiece: false });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  await prisma.$transaction(async (tx) => {
    // Retire aussi les écritures comptables liées (émission ET paiement si
    // déjà marquée payée) — sinon elles restent orphelines, et si une
    // prochaine facture réutilise ce même numéro (le numéro suivant se base
    // sur les factures encore existantes), le journal se retrouve avec deux
    // écritures pour le même numéro de facture
    await tx.ecritureComptable.deleteMany({ where: { source: { in: ["FACTURE_EMISE", "FACTURE_PAYEE"] }, sourceId: params.id } });
    await tx.facture.delete({ where: { id: params.id } });
    // Le bon redevient "En cours" — il n'est plus considéré terminé sans facture
    await tx.bonTravail.update({ where: { id: facture.bonId }, data: { statut: "EN_COURS" } });
  });

  return NextResponse.json({ ok: true });
}
