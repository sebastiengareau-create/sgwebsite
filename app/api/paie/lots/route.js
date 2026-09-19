import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { calculerPaiePourEmploye } from "@/lib/paie";

// Ces dates sont des journées civiles (Québec), pas des instants précis — on
// les ancre à midi UTC pour qu'elles retombent sur le même jour peu importe
// le fuseau horaire de lecture (le serveur tourne en UTC, l'affichage en
// heure du Québec est en retard, sinon minuit UTC recule d'un jour une fois
// affiché à Montréal).
function jourCivil(dateStr) {
  return new Date(`${dateStr.slice(0, 10)}T12:00:00Z`);
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { typePaie, periodeDebut, periodeFin, dateVersement, employeIds } = await request.json();
  if (!periodeDebut || !periodeFin || !Array.isArray(employeIds) || employeIds.length === 0) {
    return NextResponse.json({ erreur: "Période et au moins un employé sont requis." }, { status: 400 });
  }
  const dateVersementFinale = jourCivil(dateVersement || periodeFin);

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
      periodeDebut: jourCivil(periodeDebut),
      periodeFin: jourCivil(periodeFin),
      dateVersementPrevue: dateVersementFinale,
      typePaie: typePaieFinal,
      creePar: session.nom,
      paies: {
        create: resultats.map((r) => ({
          employeId: r.employeId,
          periodeDebut: jourCivil(periodeDebut),
          periodeFin: jourCivil(periodeFin),
          dateVersement: dateVersementFinale,
          heuresTravaillees: r.heuresTravaillees,
          heuresHorodateur: r.heuresHorodateur,
          boni: r.boni,
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
