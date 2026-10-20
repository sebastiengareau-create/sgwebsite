import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import NouveauBonForm from "./NouveauBonForm";
import { CLIENT } from "@/lib/client";

export default async function NouveauBonPage() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/login");
  const [clients, moduleCalendrier] = await Promise.all([
    prisma.client.findMany({
      include: {
        vehicules: { orderBy: { creeLe: "desc" } },
        // Profil avertirBonNonFacture : bons du client pas encore facturés
        ...(CLIENT.avertirBonNonFacture && {
          bons: { where: { facture: null }, orderBy: { creeLe: "asc" }, select: { id: true, numero: true, statut: true, datePrevue: true } },
        }),
      },
      orderBy: { nom: "asc" },
    }),
    prisma.parametre.findUnique({ where: { cle: "module_calendrier" } }),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <NouveauBonForm clientsExistants={clients} calendrierActif={moduleCalendrier?.valeur !== "inactif"} />
    </div>
  );
}
