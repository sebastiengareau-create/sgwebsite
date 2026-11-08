import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { posterDepensePayee, verifierPeriodeModifiable } from "@/lib/comptabilite";

// Paiement groupé : plusieurs factures impayées d'un même fournisseur payées
// d'un coup (un seul chèque, un seul virement). Chaque facture reçoit le
// même compte, mode et référence, et garde sa propre écriture de paiement
// (Comptes fournisseurs → trésorerie) — comme un paiement à l'unité. La
// transaction bancaire unique s'associe ensuite à ces écritures ensemble
// (Transactions bancaires → associer plusieurs lignes dont le total
// correspond).
export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { depenseIds, reference, compteTresorerieId, modePaiement } = await request.json();
  const ids = [...new Set(Array.isArray(depenseIds) ? depenseIds.filter((id) => typeof id === "string") : [])];
  if (ids.length === 0) {
    return NextResponse.json({ erreur: "Choisis au moins une facture." }, { status: 400 });
  }

  try {
    await verifierPeriodeModifiable(new Date(), { nouvellePiece: true });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }
  if (!compteTresorerieId) {
    return NextResponse.json({ erreur: "Choisis un compte pour le paiement." }, { status: 400 });
  }
  const compteTresorerie = await prisma.compteTresorerie.findUnique({ where: { id: compteTresorerieId }, include: { compte: true } });
  if (!compteTresorerie) return NextResponse.json({ erreur: "Compte introuvable." }, { status: 400 });

  const depenses = await prisma.depense.findMany({ where: { id: { in: ids } } });
  if (depenses.length !== ids.length) {
    return NextResponse.json({ erreur: "Une des factures est introuvable — rafraîchis la page." }, { status: 404 });
  }
  if (depenses.some((d) => d.statut !== "IMPAYEE")) {
    return NextResponse.json({ erreur: "Une des factures est déjà payée — rafraîchis la page." }, { status: 409 });
  }
  if (new Set(depenses.map((d) => d.fournisseurId)).size > 1) {
    return NextResponse.json({ erreur: "Les factures d'un paiement groupé doivent toutes venir du même fournisseur." }, { status: 400 });
  }

  const datePaiement = new Date();
  const payees = await prisma.$transaction(
    ids.map((id) =>
      prisma.depense.update({
        where: { id },
        data: {
          statut: "PAYEE",
          datePaiement,
          referenceVersement: reference || null,
          compteTresorerieId,
          modePaiement: modePaiement || null,
        },
      })
    )
  );

  for (const depense of payees) {
    try {
      await posterDepensePayee(depense, session.nom, compteTresorerie.compte.numero, modePaiement);
    } catch (e) {
      console.error("Erreur comptabilisation paiement groupé :", e);
    }
  }

  return NextResponse.json({ nombre: payees.length, total: payees.reduce((s, d) => s + d.montant, 0) });
}
