import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUTS_ACTIFS } from "@/lib/statutsEnvoi";
import { jobsDeplacementActif } from "@/lib/envois";
import { clePubliqueVapid } from "@/lib/notifications";
import { limitesJourQuebec, dateAujourdhuiQuebec } from "@/lib/temps";
import EnTete from "../components/EnTete";
import MesTachesClient from "./MesTachesClient";

// Bons envoyés à l'employé connecté (lien du SMS). Ouvert à tout employé,
// peu importe ses sections : il n'y voit que ce qui lui est adressé.
export default async function MesTaches() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await jobsDeplacementActif())) redirect(`/${session.role.toLowerCase()}`);

  // Ouvrir la page compte comme « vu »
  await prisma.envoiBon.updateMany({
    where: { employeId: session.id, statut: "ENVOYE" },
    data: { statut: "VU", vuLe: new Date() },
  });

  const { debut } = limitesJourQuebec(dateAujourdhuiQuebec());
  const envois = await prisma.envoiBon.findMany({
    where: {
      employeId: session.id,
      OR: [{ statut: { in: STATUTS_ACTIFS } }, { statut: "TERMINE", termineLe: { gte: debut } }],
    },
    include: {
      bon: {
        select: {
          id: true, numero: true, datePrevue: true,
          client: { select: { nom: true, telephone: true, adresse: true, ville: true, codePostal: true } },
          vehicule: { select: { annee: true, marque: true, modele: true, plaque: true } },
          problemes: { orderBy: { id: "asc" }, select: { id: true, description: true } },
        },
      },
    },
    orderBy: { envoyeLe: "desc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <MesTachesClient envois={envois} clePublique={await clePubliqueVapid()} />
    </div>
  );
}
