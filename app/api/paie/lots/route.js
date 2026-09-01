import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { calculerPaiePourEmploye } from "@/lib/paie";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { typePaie, periodeDebut, periodeFin, employeIds } = await request.json();
  if (!periodeDebut || !periodeFin || !Array.isArray(employeIds) || employeIds.length === 0) {
    return NextResponse.json({ erreur: "Période et au moins un employé sont requis." }, { status: 400 });
  }

  const typePaieFinal = typePaie === "VACANCES" ? "VACANCES" : "REGULIERE";

  const resultats = [];
  for (const employeId of employeIds) {
    const resultat = await calculerPaiePourEmploye(employeId, { periodeDebut, periodeFin, typePaie: typePaieFinal });
    if (resultat.erreur) {
      return NextResponse.json({ erreur: `${resultat.erreur} (employé ${employeId})` }, { status: 400 });
    }
    resultats.push({ employeId, ...resultat });
  }

  const dernierLot = await prisma.lotPaie.findFirst({ orderBy: { numero: "desc" } });
  let prochainNum = 1;
  if (dernierLot) {
    const partieNum = parseInt(dernierLot.numero.split("-")[1], 10);
    if (!isNaN(partieNum)) prochainNum = partieNum + 1;
  }
  const numero = `PAIE-${String(1000 + prochainNum).slice(1)}`;

  const lot = await prisma.lotPaie.create({
    data: {
      numero,
      periodeDebut: new Date(periodeDebut),
      periodeFin: new Date(periodeFin),
      typePaie: typePaieFinal,
      creePar: session.nom,
      paies: {
        create: resultats.map((r) => ({
          employeId: r.employeId,
          periodeDebut: new Date(periodeDebut),
          periodeFin: new Date(periodeFin),
          heuresTravaillees: r.heuresTravaillees,
          salaireBrut: r.salaireBrutPeriode,
          rrqEmploye: r.rrqEmploye,
          rqapEmploye: r.rqapEmploye,
          aeEmploye: r.aeEmploye,
          impotFederal: r.impotFederal,
          impotQuebec: r.impotQuebec,
          totalDeductions: r.totalDeductions,
          salaireNet: r.salaireNet,
          rrqEmployeur: r.rrqEmployeur,
          rqapEmployeur: r.rqapEmployeur,
          aeEmployeur: r.aeEmployeur,
          vacancesAccumulees: r.vacancesAccumulees,
          typePaie: typePaieFinal,
          statut: "BROUILLON",
        })),
      },
    },
  });

  return NextResponse.json({ id: lot.id, numero: lot.numero });
}
