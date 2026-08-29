import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { calculerPaie } from "@/lib/paie";

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { employeId, periodeDebut, periodeFin, heuresManuelles, typePaie, montantVacances } = await request.json();
  if (!employeId || !periodeDebut || !periodeFin) {
    return NextResponse.json({ erreur: "Employé et période requis." }, { status: 400 });
  }

  const employe = await prisma.user.findUnique({ where: { id: employeId } });
  if (!employe) return NextResponse.json({ erreur: "Employé introuvable." }, { status: 404 });

  const debut = new Date(periodeDebut);
  const fin = new Date(periodeFin);
  if (fin <= debut) return NextResponse.json({ erreur: "La fin doit être après le début." }, { status: 400 });

  // Solde de vacances disponible — accumulé sur les paies régulières, moins
  // ce qui a déjà été versé via une paie de vacances précédente
  const [accumule, dejaVerse] = await Promise.all([
    prisma.paie.aggregate({ where: { employeId, statut: { not: "CORRIGEE" }, typePaie: "REGULIERE" }, _sum: { vacancesAccumulees: true } }),
    prisma.paie.aggregate({ where: { employeId, statut: { not: "CORRIGEE" }, typePaie: "VACANCES" }, _sum: { salaireBrut: true } }),
  ]);
  const soldeVacances = Math.max(0, (accumule._sum.vacancesAccumulees || 0) - (dejaVerse._sum.salaireBrut || 0));

  let heuresTravaillees = 0;
  let heuresHorodateur = null;
  let salaireBrutPeriode = 0;

  if (typePaie === "VACANCES") {
    salaireBrutPeriode = montantVacances !== undefined && montantVacances !== "" ? Number(montantVacances) : soldeVacances;
  } else if (employe.typeRemuneration === "SALAIRE") {
    const periodesParAn = { HEBDOMADAIRE: 52, BIHEBDOMADAIRE: 26, BIMENSUEL: 24, MENSUEL: 12 }[employe.frequencePaie] || 26;
    salaireBrutPeriode = (employe.salaireAnnuel || 0) / periodesParAn;
  } else {
    const [entrees, entreesInternes, parametreTaux] = await Promise.all([
      prisma.entreeTemps.findMany({ where: { employeId, fin: { not: null }, debut: { gte: debut, lte: fin } } }),
      prisma.entreeTempsInterne.findMany({ where: { employeId, fin: { not: null }, debut: { gte: debut, lte: fin } } }),
      prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } }),
    ]);
    heuresHorodateur =
      entrees.reduce((s, e) => s + dureeHeures(e.debut, e.fin), 0) +
      entreesInternes.reduce((s, e) => s + dureeHeures(e.debut, e.fin), 0);
    heuresTravaillees = heuresManuelles !== undefined && heuresManuelles !== null && heuresManuelles !== ""
      ? Number(heuresManuelles)
      : heuresHorodateur;
    const taux = employe.tauxHoraireEmploye || Number(parametreTaux?.valeur || 95);
    salaireBrutPeriode = heuresTravaillees * taux;
  }

  // Cotisations déjà versées cette année, pour respecter les maximums annuels
  const anneeCourante = fin.getFullYear();
  const paiesAnnee = await prisma.paie.findMany({
    where: { employeId, periodeFin: { gte: new Date(`${anneeCourante}-01-01`), lt: new Date(`${anneeCourante + 1}-01-01`) } },
  });
  const dejaVerseAnnee = paiesAnnee.reduce(
    (acc, p) => ({ rrq: acc.rrq + p.rrqEmploye, rqap: acc.rqap + p.rqapEmploye, ae: acc.ae + p.aeEmploye }),
    { rrq: 0, rqap: 0, ae: 0 }
  );

  const resultat = calculerPaie(salaireBrutPeriode, employe.frequencePaie, dejaVerseAnnee);
  const vacancesAccumulees = typePaie === "VACANCES" ? 0 : Math.round(salaireBrutPeriode * (employe.tauxVacances / 100) * 100) / 100;

  return NextResponse.json({
    employe: { id: employe.id, nom: employe.nom, typeRemuneration: employe.typeRemuneration, frequencePaie: employe.frequencePaie, tauxVacances: employe.tauxVacances },
    heuresTravaillees,
    heuresHorodateur,
    vacancesAccumulees,
    soldeVacances,
    typePaie: typePaie === "VACANCES" ? "VACANCES" : "REGULIERE",
    ...resultat,
  });
}
