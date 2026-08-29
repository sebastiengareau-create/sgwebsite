import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import EnTete from "../../../components/EnTete";
import JournalPaieClient from "./JournalPaieClient";

export default async function JournalPaie({ searchParams }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/gerant");

  const aujourdhui = dateAujourdhuiQuebec();
  const [an] = aujourdhui.split("-");
  const debutStr = searchParams?.debut || `${an}-01-01`;
  const finStr = searchParams?.fin || aujourdhui;
  const debut = new Date(`${debutStr}T00:00:00`);
  const fin = new Date(`${finStr}T23:59:59`);

  const paies = await prisma.paie.findMany({
    where: { periodeFin: { gte: debut, lte: fin }, statut: { not: "CORRIGEE" } },
    include: { employe: true },
    orderBy: { periodeFin: "asc" },
  });

  // Sommaire par employé
  const parEmploye = {};
  for (const p of paies) {
    const nom = p.employe.nom;
    if (!parEmploye[nom]) {
      parEmploye[nom] = { brut: 0, net: 0, deductions: 0, vacancesAccumulees: 0, vacancesVersees: 0, chargesEmployeur: 0, nbPaies: 0 };
    }
    parEmploye[nom].brut += p.salaireBrut;
    parEmploye[nom].net += p.salaireNet;
    parEmploye[nom].deductions += p.totalDeductions;
    if (p.typePaie === "VACANCES") {
      parEmploye[nom].vacancesVersees += p.salaireBrut;
    } else {
      parEmploye[nom].vacancesAccumulees += p.vacancesAccumulees;
    }
    parEmploye[nom].chargesEmployeur += p.rrqEmployeur + p.rqapEmployeur + p.aeEmployeur;
    parEmploye[nom].nbPaies += 1;
  }
  const sommaireEmployes = Object.entries(parEmploye).sort((a, b) => b[1].brut - a[1].brut);

  const totaux = paies.reduce(
    (acc, p) => ({
      brut: acc.brut + p.salaireBrut,
      net: acc.net + p.salaireNet,
      deductions: acc.deductions + p.totalDeductions,
      vacancesAccumulees: acc.vacancesAccumulees + (p.typePaie === "VACANCES" ? 0 : p.vacancesAccumulees),
      vacancesVersees: acc.vacancesVersees + (p.typePaie === "VACANCES" ? p.salaireBrut : 0),
      chargesEmployeur: acc.chargesEmployeur + p.rrqEmployeur + p.rqapEmployeur + p.aeEmployeur,
    }),
    { brut: 0, net: 0, deductions: 0, vacancesAccumulees: 0, vacancesVersees: 0, chargesEmployeur: 0 }
  );

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <JournalPaieClient paies={paies} sommaireEmployes={sommaireEmployes} totaux={totaux} debutStr={debutStr} finStr={finStr} />
    </div>
  );
}
