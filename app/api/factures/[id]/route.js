import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterFacturePayee } from "@/lib/comptabilite";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { statut } = await request.json();
  if (!["IMPAYEE", "PAYEE", "ANNULEE"].includes(statut)) {
    return NextResponse.json({ erreur: "Statut invalide." }, { status: 400 });
  }

  const ancienneFacture = await prisma.facture.findUnique({ where: { id: params.id } });

  const facture = await prisma.facture.update({
    where: { id: params.id },
    data: {
      statut,
      datePaiement: statut === "PAYEE" ? new Date() : null,
    },
  });

  // Comptabilise l'encaissement seulement au moment où ça bascule VERS
  // "Payée" (pas si c'était déjà payée) — évite les doublons d'écritures
  let avertissementComptable = null;
  if (statut === "PAYEE" && ancienneFacture?.statut !== "PAYEE") {
    try {
      await posterFacturePayee(facture, session.nom);
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

  await prisma.$transaction(async (tx) => {
    await tx.facture.delete({ where: { id: params.id } });
    // Le bon redevient "En cours" — il n'est plus considéré terminé sans facture
    await tx.bonTravail.update({ where: { id: facture.bonId }, data: { statut: "EN_COURS" } });
  });

  return NextResponse.json({ ok: true });
}
