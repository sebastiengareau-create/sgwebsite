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
      rrqEmployeur, rqapEmployeur, aeEmployeur,
      vacancesAccumulees: vacancesAccumulees || 0,
      typePaie: typePaie === "VACANCES" ? "VACANCES" : "REGULIERE",
      statut: "VERSEE",
      dateVersement: new Date(),
    },
  });

  let avertissementComptable = null;
  try {
    await posterPaie(paie, session.nom);
  } catch (e) {
    if (e.message.startsWith("PERIODE_LOCK:")) {
      avertissementComptable = "La paie a été enregistrée, mais aucune écriture comptable n'a été créée : " + e.message.replace("PERIODE_LOCK:", "").split("\n")[0];
    } else {
      console.error("Erreur comptabilisation de la paie :", e);
      avertissementComptable = "La paie a été enregistrée, mais la comptabilisation a échoué : " + e.message;
    }
  }

  return NextResponse.json({ ...paie, avertissementComptable });
}
