import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { chargerReglagesDisponibilites } from "@/lib/disponibilites";
import EnTete from "../../../components/EnTete";
import ParametresWebClient from "./ParametresWebClient";

// Calendrier → Paramètres web : ce que le site de réservation en ligne
// offre aux clients — les services (gérés ici) et un rappel des
// disponibilités (heures d'ouverture, réglées dans Paramètres).
export default async function ParametresWeb() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "calendrier"))) redirect("/mecanicien");

  const parametreCalendrier = await prisma.parametre.findUnique({ where: { cle: "module_calendrier" } });
  if (parametreCalendrier?.valeur === "inactif") redirect("/secretaire");

  const [services, reglages, accesParametres] = await Promise.all([
    prisma.serviceWeb.findMany({ orderBy: [{ actif: "desc" }, { nom: "asc" }] }),
    chargerReglagesDisponibilites(),
    aAccesSection(session, "parametres"),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ParametresWebClient services={services} reglages={reglages} accesParametres={accesParametres} />
    </div>
  );
}
