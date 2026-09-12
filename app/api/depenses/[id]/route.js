import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterDepenseRecue, posterDepensePayee, verifierPeriodeModifiable } from "@/lib/comptabilite";

// Voir app/api/depenses/route.js : ancre une date-seule à midi UTC pour
// qu'elle retombe sur le même jour civil peu importe le fuseau d'affichage.
function jourCivil(dateStr) {
  return new Date(`${dateStr.slice(0, 10)}T12:00:00Z`);
}

export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const corps = await request.json();

  // Corriger les champs (postes, montants, fournisseur…) — distinct du
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
// (les postes seuls n'affectent jamais l'écriture de paiement, qui ne touche
// que Comptes fournisseurs et le compte de trésorerie choisi). Les lignes
// (fractionnement par poste) sont toujours remplacées en bloc — plus simple
// et sûr que de tenter de faire correspondre l'ancien et le nouveau détail.
async function modifierDepense(id, corps, session) {
  const { fournisseurId, description, lignes, tpsPayee, tvqPayee, dateFacture } = corps;

  const depense = await prisma.depense.findUnique({ where: { id }, include: { lignes: true } });
  if (!depense) return NextResponse.json({ erreur: "Dépense introuvable." }, { status: 404 });

  const nouvelleDate = dateFacture ? jourCivil(dateFacture) : depense.dateFacture;
  try {
    await verifierPeriodeModifiable(depense.dateFacture, { nouvellePiece: false });
    if (dateFacture) await verifierPeriodeModifiable(nouvelleDate, { nouvellePiece: true });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  const lignesValides = lignes !== undefined
    ? (lignes || []).filter((l) => l.categorieDepenseId && Number(l.montant) > 0)
    : null;
  if (lignesValides !== null && lignesValides.length === 0) {
    return NextResponse.json({ erreur: "Au moins une ligne (poste + montant) est requise." }, { status: 400 });
  }

  let categorieParId = {};
  if (lignesValides) {
    const categories = await prisma.categorieDepense.findMany({
      where: { id: { in: lignesValides.map((l) => l.categorieDepenseId) } },
    });
    categorieParId = Object.fromEntries(categories.map((c) => [c.id, c]));
    if (lignesValides.some((l) => !categorieParId[l.categorieDepenseId])) {
      return NextResponse.json({ erreur: "Poste de dépense introuvable." }, { status: 400 });
    }
  }

  const nouveauTps = tpsPayee !== undefined ? Number(tpsPayee) || 0 : depense.tpsPayee;
  const nouveauTvq = tvqPayee !== undefined ? Number(tvqPayee) || 0 : depense.tvqPayee;
  const sommeLignes = lignesValides
    ? lignesValides.reduce((s, l) => s + Number(l.montant), 0)
    : depense.lignes.reduce((s, l) => s + l.montant, 0);
  const nouveauMontant = sommeLignes + nouveauTps + nouveauTvq;

  const depenseMaj = await prisma.$transaction(async (tx) => {
    if (lignesValides) {
      await tx.ligneDepense.deleteMany({ where: { depenseId: id } });
    }
    return tx.depense.update({
      where: { id },
      data: {
        fournisseurId: fournisseurId || depense.fournisseurId,
        description: description !== undefined ? description : depense.description,
        montant: nouveauMontant,
        tpsPayee: nouveauTps,
        tvqPayee: nouveauTvq,
        dateFacture: nouvelleDate,
        ...(lignesValides && {
          // pieceId/qteRecue passent tels quels si présents (la réception de
          // stock déjà appliquée à la création n'est pas rejouée ici — voir
          // app/api/depenses/route.js — mais le lien ne doit pas se perdre
          // juste parce qu'une autre ligne a été corrigée).
          lignes: {
            create: lignesValides.map((l) => ({
              categorieDepenseId: l.categorieDepenseId,
              montant: Number(l.montant),
              description: l.description || null,
              pieceId: l.pieceId || null,
              qteRecue: l.pieceId ? (Number(l.qteRecue) || null) : null,
            })),
          },
        }),
      },
      include: { lignes: { include: { categorieDepense: true } } },
    });
  });

  // Régénère l'écriture "reçue" (celle qui débite les postes et crédite
  // Comptes fournisseurs) avec les valeurs corrigées — l'ancienne est
  // retirée d'abord pour ne jamais en garder deux pour la même dépense.
  await prisma.ecritureComptable.deleteMany({ where: { source: "DEPENSE_RECUE", sourceId: id } });
  try {
    await posterDepenseRecue(
      {
        ...depenseMaj,
        lignesPourEcriture: depenseMaj.lignes.map((l) => ({
          compteDepenseNumero: l.categorieDepense.compteDepenseNumero,
          montant: l.montant,
          description: l.description,
        })),
      },
      session.nom
    );
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

  // Retire aussi les écritures comptables liées, pour garder les livres
  // cohérents (les lignes de fractionnement partent en cascade avec la dépense)
  await prisma.ecritureComptable.deleteMany({ where: { source: { in: ["DEPENSE_RECUE", "DEPENSE_PAYEE"] }, sourceId: params.id } });
  await prisma.depense.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
