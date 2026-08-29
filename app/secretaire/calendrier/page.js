import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { dateAujourdhuiQuebec, limitesJourQuebec } from "@/lib/temps";
import EnTete from "../../components/EnTete";
import CalendrierClient from "./CalendrierClient";

export default async function Calendrier({ searchParams }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) redirect("/mecanicien");

  const parametreCalendrier = await prisma.parametre.findUnique({ where: { cle: "module_calendrier" } });
  if (parametreCalendrier?.valeur === "inactif") redirect("/secretaire");

  const dateStr = searchParams?.date || dateAujourdhuiQuebec();

  // Détermine le lundi de la semaine contenant dateStr (calcul en UTC pour
  // éviter tout problème de fuseau horaire)
  const [an, mois, jour] = dateStr.split("-").map(Number);
  const dateRef = new Date(Date.UTC(an, mois - 1, jour));
  const jourSemaine = dateRef.getUTCDay(); // 0=dim .. 6=sam
  const decalageLundi = jourSemaine === 0 ? -6 : 1 - jourSemaine;
  const lundi = new Date(dateRef);
  lundi.setUTCDate(lundi.getUTCDate() + decalageLundi);

  const jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lundi);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const { debut } = limitesJourQuebec(jours[0]);
  const { fin } = limitesJourQuebec(jours[6]);

  const rendezVous = await prisma.rendezVous.findMany({
    where: { date: { gte: debut, lte: fin } },
    orderBy: { date: "asc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <CalendrierClient jours={jours} rendezVous={rendezVous} dateSelectionnee={dateStr} />
    </div>
  );
}
