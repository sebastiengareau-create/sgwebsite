import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { chargerReglagesDisponibilites } from "@/lib/disponibilites";
import { chargerSymptomes } from "@/lib/symptomesWeb";
import EnTete from "../../../components/EnTete";
import ParametresWebClient from "./ParametresWebClient";

// Calendrier → Paramètres web : ce que le site de réservation en ligne
// offre aux clients — les services et l'option « Dites-nous les
// symptômes » (gérés ici) et un rappel des
// disponibilités (heures d'ouverture, réglées dans Paramètres).
export default async function ParametresWeb() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) redirect("/mecanicien");

  const parametreCalendrier = await prisma.parametre.findUnique({ where: { cle: "module_calendrier" } });
  if (parametreCalendrier?.valeur === "inactif") redirect("/secretaire");

  const [services, symptomes, reglages, accesParametres] = await Promise.all([
    prisma.serviceWeb.findMany({ orderBy: [{ actif: "desc" }, { nom: "asc" }] }),
    chargerSymptomes(prisma),
    chargerReglagesDisponibilites(),
    aAccesSection(session, "parametres"),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ParametresWebClient services={services} symptomes={symptomes} reglages={reglages} accesParametres={accesParametres} />
    </div>
  );
}
