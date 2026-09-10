import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterDepensePayee, verifierPeriodeModifiable } from "@/lib/comptabilite";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { statut, reference, compteTresorerieId, modePaiement } = await request.json();
  if (!["IMPAYEE", "PAYEE"].includes(statut)) {
    return NextResponse.json({ erreur: "Statut invalide." }, { status: 400 });
  }

  let compteTresorerie = null;
  if (statut === "PAYEE") {
    try {
      await verifierPeriodeModifiable(new Date(), { nouvellePiece: true });
    } catch (e) {
      return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
    }
    if (!compteTresorerieId) {
      return NextResponse.json({ erreur: "Choisis un compte pour le paiement." }, { status: 400 });
    }
    compteTresorerie = await prisma.compteTresorerie.findUnique({ where: { id: compteTresorerieId }, include: { compte: true } });
    if (!compteTresorerie) return NextResponse.json({ erreur: "Compte introuvable." }, { status: 400 });
  }

  const ancienne = await prisma.depense.findUnique({ where: { id: params.id } });
  const depense = await prisma.depense.update({
    where: { id: params.id },
    data: {
      statut,
      datePaiement: statut === "PAYEE" ? new Date() : null,
      referenceVersement: statut === "PAYEE" ? (reference || null) : null,
      compteTresorerieId: statut === "PAYEE" ? compteTresorerieId : null,
      modePaiement: statut === "PAYEE" ? (modePaiement || null) : null,
    },
  });

  if (statut === "PAYEE" && ancienne?.statut !== "PAYEE") {
    try {
      await posterDepensePayee(depense, session.nom, compteTresorerie.compte.numero, modePaiement);
    } catch (e) {
      console.error("Erreur comptabilisation paiement dépense :", e);
    }
  }

  return NextResponse.json(depense);
}

export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const depense = await prisma.depense.findUnique({ where: { id: params.id } });
  if (!depense) return NextResponse.json({ erreur: "Dépense introuvable." }, { status: 404 });

  try {
    await verifierPeriodeModifiable(depense.dateFacture, { nouvellePiece: false });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  // Retire aussi les écritures comptables liées, pour garder les livres cohérents
  await prisma.ecritureComptable.deleteMany({ where: { source: { in: ["DEPENSE_RECUE", "DEPENSE_PAYEE"] }, sourceId: params.id } });
  await prisma.depense.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
