import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterFacturePayee, verifierPeriodeModifiable } from "@/lib/comptabilite";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { statut, compteTresorerieId, modePaiement, reference } = await request.json();
  if (!["IMPAYEE", "PAYEE", "ANNULEE"].includes(statut)) {
    return NextResponse.json({ erreur: "Statut invalide." }, { status: 400 });
  }

  const ancienneFacture = await prisma.facture.findUnique({ where: { id: params.id } });

  let compteTresorerie = null;
  if (statut === "PAYEE") {
    if (!compteTresorerieId) {
      return NextResponse.json({ erreur: "Choisis un compte pour l'encaissement." }, { status: 400 });
    }
    compteTresorerie = await prisma.compteTresorerie.findUnique({ where: { id: compteTresorerieId }, include: { compte: true } });
    if (!compteTresorerie) return NextResponse.json({ erreur: "Compte introuvable." }, { status: 400 });
  }

  const facture = await prisma.facture.update({
    where: { id: params.id },
    data: {
      statut,
      datePaiement: statut === "PAYEE" ? new Date() : null,
      compteTresorerieId: statut === "PAYEE" ? compteTresorerieId : null,
      modePaiement: statut === "PAYEE" ? (modePaiement || null) : null,
      referenceVersement: statut === "PAYEE" ? (reference || null) : null,
    },
  });

  // Comptabilise l'encaissement seulement au moment où ça bascule VERS
  // "Payée" (pas si c'était déjà payée) — évite les doublons d'écritures
  let avertissementComptable = null;
  if (statut === "PAYEE" && ancienneFacture?.statut !== "PAYEE") {
    try {
      await posterFacturePayee(facture, session.nom, compteTresorerie.compte.numero, modePaiement);
    } catch (e) {
      if (e.message.startsWith("PERIODE_LOCK:")) {
        avertissementComptable = e.message.replace("PERIODE_LOCK:", "").split("\n")[0];
      } else {
        console.error("Erreur comptabilisation facture payée :", e);
      }
    }
  }

  return NextResponse.json({ ...facture, avertissementComptable });
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  // Restreint au gérant seulement — suppression définitive, pensée pour
  // nettoyer des factures de test, pas pour un usage courant une fois en
  // production réelle.
  if (!session || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Seul le gérant peut supprimer une facture." }, { status: 403 });
  }

  const facture = await prisma.facture.findUnique({ where: { id: params.id } });
  if (!facture) return NextResponse.json({ erreur: "Facture introuvable." }, { status: 404 });

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
