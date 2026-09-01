import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { calculerPaiePourEmploye } from "@/lib/paie";

// Ajoute un employé à un lot déjà en brouillon (oublié à la création, ou pas
// encore traité au moment où le lot a été calculé).
export async function POST(request, { params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const lot = await prisma.lotPaie.findUnique({ where: { id: params.id }, include: { paies: true } });
  if (!lot) return NextResponse.json({ erreur: "Lot introuvable." }, { status: 404 });
  if (lot.statut !== "BROUILLON") {
    return NextResponse.json({ erreur: "Ce lot est déjà comptabilisé — impossible d'y ajouter un employé." }, { status: 409 });
  }

  const { employeId } = await request.json();
  if (!employeId) return NextResponse.json({ erreur: "Employé requis." }, { status: 400 });
  if (lot.paies.some((p) => p.employeId === employeId)) {
    return NextResponse.json({ erreur: "Cet employé est déjà dans ce lot." }, { status: 409 });
  }

  const resultat = await calculerPaiePourEmploye(employeId, {
    periodeDebut: lot.periodeDebut,
    periodeFin: lot.periodeFin,
    typePaie: lot.typePaie,
  });
  if (resultat.erreur) return NextResponse.json({ erreur: resultat.erreur }, { status: 400 });

  const paie = await prisma.paie.create({
    data: {
      employeId,
      lotId: lot.id,
      periodeDebut: lot.periodeDebut,
      periodeFin: lot.periodeFin,
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
      typePaie: lot.typePaie,
      statut: "BROUILLON",
    },
    include: { employe: true },
  });

  return NextResponse.json(paie);
}
