import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterDepenseRecue, posterDepensePayee, verifierPeriodeModifiable } from "@/lib/comptabilite";

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const corps = await request.json();

  // Corriger les champs (poste, montant, fournisseur…) — distinct du
  // changement de statut ci-dessous, reconnu par l'absence de `statut`.
  if (corps.statut === undefined) {
    return modifierDepense(params.id, corps, session);
  }

  const { statut, reference, compteTresorerieId, modePaiement } = corps;
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

// Corrige les champs d'une dépense déjà créée (ex : mauvais poste choisi au
// départ) — régénère l'écriture "reçue" avec les valeurs corrigées, et
// l'écriture "payée" aussi si le montant a changé sur une dépense déjà payée
// (le poste seul n'affecte jamais l'écriture de paiement, qui ne touche que
// Comptes fournisseurs et le compte de trésorerie choisi).
async function modifierDepense(id, corps, session) {
  const { fournisseurId, categorieDepenseId, description, montant, tpsPayee, tvqPayee, dateFacture } = corps;

  const depense = await prisma.depense.findUnique({ where: { id } });
  if (!depense) return NextResponse.json({ erreur: "Dépense introuvable." }, { status: 404 });

  const nouvelleDate = dateFacture ? new Date(dateFacture) : depense.dateFacture;
  try {
    await verifierPeriodeModifiable(depense.dateFacture, { nouvellePiece: false });
    if (dateFacture) await verifierPeriodeModifiable(nouvelleDate, { nouvellePiece: true });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  let categorie = null;
  if (categorieDepenseId) {
    categorie = await prisma.categorieDepense.findUnique({ where: { id: categorieDepenseId } });
    if (!categorie) return NextResponse.json({ erreur: "Poste de dépense introuvable." }, { status: 400 });
  } else {
    categorie = await prisma.categorieDepense.findUnique({ where: { id: depense.categorieDepenseId } });
  }

  const nouveauMontant = montant !== undefined ? Number(montant) : depense.montant;

  const depenseMaj = await prisma.depense.update({
    where: { id },
    data: {
      fournisseurId: fournisseurId || depense.fournisseurId,
      categorieDepenseId: categorieDepenseId || depense.categorieDepenseId,
      description: description !== undefined ? description : depense.description,
      montant: nouveauMontant,
      tpsPayee: tpsPayee !== undefined ? Number(tpsPayee) || 0 : depense.tpsPayee,
      tvqPayee: tvqPayee !== undefined ? Number(tvqPayee) || 0 : depense.tvqPayee,
      dateFacture: nouvelleDate,
    },
  });

  // Régénère l'écriture "reçue" (celle qui débite le poste et crédite
  // Comptes fournisseurs) avec les valeurs corrigées — l'ancienne est
  // retirée d'abord pour ne jamais en garder deux pour la même dépense.
  await prisma.ecritureComptable.deleteMany({ where: { source: "DEPENSE_RECUE", sourceId: id } });
  try {
    await posterDepenseRecue({ ...depenseMaj, compteDepenseNumero: categorie.compteDepenseNumero }, session.nom);
  } catch (e) {
    console.error("Erreur comptabilisation dépense corrigée :", e);
  }

  // Si le montant a changé sur une dépense déjà payée, l'écriture de
  // paiement doit aussi être régénérée pour rester équilibrée
  if (depense.statut === "PAYEE" && nouveauMontant !== depense.montant && depense.compteTresorerieId) {
    const compteTresorerie = await prisma.compteTresorerie.findUnique({ where: { id: depense.compteTresorerieId }, include: { compte: true } });
    if (compteTresorerie) {
      await prisma.ecritureComptable.deleteMany({ where: { source: "DEPENSE_PAYEE", sourceId: id } });
      try {
        await posterDepensePayee(depenseMaj, session.nom, compteTresorerie.compte.numero, depenseMaj.modePaiement);
      } catch (e) {
        console.error("Erreur comptabilisation paiement corrigé :", e);
      }
    }
  }

  return NextResponse.json(depenseMaj);
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
