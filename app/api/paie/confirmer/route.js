import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { posterPaie } from "@/lib/comptabilite";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json();
  const {
    employeId, periodeDebut, periodeFin, heuresTravaillees, salaireBrutPeriode,
    rrqEmploye, rqapEmploye, aeEmploye, impotFederal, impotQuebec, totalDeductions, salaireNet,
    rrqEmployeur, rqapEmployeur, aeEmployeur, vacancesAccumulees, typePaie,
    rrq2Employe = 0, rrq2Employeur = 0, fssEmployeur = 0, cntEmployeur = 0, cnesstEmployeur = 0,
  } = body;

  if (!employeId || !periodeDebut || !periodeFin) {
    return NextResponse.json({ erreur: "Données manquantes." }, { status: 400 });
  }

  const paie = await prisma.paie.create({
    data: {
      employeId,
      periodeDebut: new Date(periodeDebut),
      periodeFin: new Date(periodeFin),
      heuresTravaillees: heuresTravaillees || 0,
      salaireBrut: salaireBrutPeriode,
      rrqEmploye, rqapEmploye, aeEmploye, impotFederal, impotQuebec, totalDeductions, salaireNet,
      rrqEmployeur, rqapEmployeur, aeEmployeur, rrq2Employe, rrq2Employeur, fssEmployeur, cntEmployeur, cnesstEmployeur,
      vacancesAccumulees: vacancesAccumulees || 0,
      typePaie: typePaie === "VACANCES" ? "VACANCES" : "REGULIERE",
      statut: "VERSEE",
      dateVersement: new Date(),
    },
  });

  // Pas de paie « versée » sans son écriture comptable : si l'écriture
  // échoue, la paie n'est pas gardée
  try {
    await posterPaie(paie, session.nom);
  } catch (e) {
    await prisma.paie.delete({ where: { id: paie.id } });
    if (e.message.startsWith("PERIODE_LOCK:")) {
      return NextResponse.json({ erreur: "Paie non enregistrée : " + e.message.replace("PERIODE_LOCK:", "").split("\n")[0] }, { status: 423 });
    }
    console.error("Erreur comptabilisation de la paie :", e);
    return NextResponse.json({ erreur: "Paie non enregistrée : la comptabilisation a échoué." }, { status: 500 });
  }

  return NextResponse.json({ ...paie, avertissementComptable: null });
}
