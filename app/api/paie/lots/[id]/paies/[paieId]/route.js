import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { calculerPaiePourEmploye } from "@/lib/paie";

// Ajuste une paie précise à l'intérieur d'un lot encore en brouillon —
// recalcule toujours côté serveur (jamais en confiance aveugle des chiffres
// soumis), à partir des nouvelles heures ou du nouveau montant de vacances.
export async function PATCH(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const lot = await prisma.lotPaie.findUnique({ where: { id: params.id } });
  if (!lot) return NextResponse.json({ erreur: "Lot introuvable." }, { status: 404 });
  if (lot.statut !== "BROUILLON") {
    return NextResponse.json({ erreur: "Ce lot est déjà comptabilisé — impossible d'ajuster une paie individuellement ici." }, { status: 409 });
  }

  const paie = await prisma.paie.findUnique({ where: { id: params.paieId } });
  if (!paie || paie.lotId !== lot.id) return NextResponse.json({ erreur: "Paie introuvable dans ce lot." }, { status: 404 });

  const { heuresManuelles, montantVacances, boni } = await request.json();

  const resultat = await calculerPaiePourEmploye(paie.employeId, {
    periodeDebut: lot.periodeDebut,
    periodeFin: lot.periodeFin,
    typePaie: lot.typePaie,
    heuresManuelles,
    montantVacances,
    boni,
  });
  if (resultat.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 });

  const misAJour = await prisma.paie.update({
    where: { id: paie.id },
    data: {
      heuresTravaillees: resultat.heuresTravaillees,
      heuresHorodateur: resultat.heuresHorodateur,
      boni: resultat.boni,
      salaireBrut: resultat.salaireBrutPeriode,
      rrqEmploye: resultat.rrqEmploye,
      rqapEmploye: resultat.rqapEmploye,
      aeEmploye: resultat.aeEmploye,
      impotFederal: resultat.impotFederal,
      impotQuebec: resultat.impotQuebec,
      totalDeductions: resultat.totalDeductions,
      salaireNet: resultat.salaireNet,
      rrqEmployeur: resultat.rrqEmployeur,
      rqapEmployeur: resultat.rqapEmployeur,
      aeEmployeur: resultat.aeEmployeur,
      vacancesAccumulees: resultat.vacancesAccumulees,
    },
  });

  return NextResponse.json(misAJour);
}

// Retire un employé du lot (tant qu'il est en brouillon) — le reste du lot continue.
export async function DELETE(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const lot = await prisma.lotPaie.findUnique({ where: { id: params.id } });
  if (!lot) return NextResponse.json({ erreur: "Lot introuvable." }, { status: 404 });
  if (lot.statut !== "BROUILLON") {
    return NextResponse.json({ erreur: "Ce lot est déjà comptabilisé." }, { status: 409 });
  }

  const paie = await prisma.paie.findUnique({ where: { id: params.paieId } });
  if (!paie || paie.lotId !== lot.id) return NextResponse.json({ erreur: "Paie introuvable dans ce lot." }, { status: 404 });

  await prisma.paie.delete({ where: { id: paie.id } });
  return NextResponse.json({ ok: true });
}
