import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { dateAujourdhuiQuebec, limitesJourQuebec } from "@/lib/temps";
import EnTete from "../../components/EnTete";
import RapportsClient from "./RapportsClient";

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}

const CLES_JOURS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"]; // aligné sur Date.getUTCDay() : 0=dim

export default async function RapportJournalier({ searchParams }) {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) redirect("/gerant");

  const dateStr = searchParams?.date || dateAujourdhuiQuebec();
  const { debut: debutJour, fin: finJour } = limitesJourQuebec(dateStr);
  const [an, mois, jour] = dateStr.split("-").map(Number);
  const jourSemaine = CLES_JOURS[new Date(Date.UTC(an, mois - 1, jour)).getUTCDay()];

  const [parametres, mecaniciens, entrees, entreesInternes] = await Promise.all([
    prisma.parametre.findMany(),
    prisma.user.findMany({ where: { role: "MECANICIEN" }, orderBy: { nom: "asc" } }),
    prisma.entreeTemps.findMany({
      where: { debut: { gte: debutJour, lte: finJour } },
      include: {
        employe: true,
        probleme: { include: { bon: { include: { client: true, problemes: { orderBy: { id: "asc" } } } } } },
      },
      orderBy: { debut: "asc" },
    }),
    prisma.entreeTempsInterne.findMany({
      where: { debut: { gte: debutJour, lte: finJour } },
      include: { employe: true, tacheInterne: true },
      orderBy: { debut: "asc" },
    }),
  ]);

  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const heuresAttendues = Number(dict[`heures_${jourSemaine}`] ?? 8);
  const coutHoraire = Number(dict.cout_horaire_mecanicien || 95);
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);

  const parMecanicien = mecaniciens.map((m) => {
    const siennes = entrees.filter((e) => e.employeId === m.id);
    const totalHeures = siennes.reduce(
      (s, e) => s + (e.fin ? dureeHeures(e.debut, e.fin) : dureeHeures(e.debut, new Date().toISOString())),
      0
    );
    const siennesInternes = entreesInternes.filter((e) => e.employeId === m.id);
    const totalHeuresInternes = siennesInternes.reduce(
      (s, e) => s + (e.fin ? dureeHeures(e.debut, e.fin) : dureeHeures(e.debut, new Date().toISOString())),
      0
    );
    // Présent dès qu'il y a un poinçon, facturable OU interne — les heures
    // internes ne comptent jamais dans heuresPoinconnees (qui sert au calcul
    // du revenu), seulement dans la présence et le total d'heures travaillées
    return {
      employe: m,
      entrees: siennes,
      entreesInternes: siennesInternes,
      heuresPoinconnees: totalHeures,
      heuresInternes: totalHeuresInternes,
    };
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RapportsClient
        dateStr={dateStr}
        parMecanicien={parMecanicien}
        heuresAttendues={heuresAttendues}
        coutHoraire={coutHoraire}
        tauxHoraireClient={tauxHoraireClient}
      />
    </div>
  );
}
