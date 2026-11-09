import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import NouveauBonForm from "../nouveau/NouveauBonForm";

// Nouvelle facture comptoir (lib/comptoir.js) : le formulaire du nouveau
// bon, sans véhicule ni date prévue
export default async function NouvelleFactureComptoirPage() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/login");
  const clients = await prisma.client.findMany({
    include: { vehicules: { orderBy: { creeLe: "desc" } } },
    orderBy: { nom: "asc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <NouveauBonForm clientsExistants={clients} calendrierActif={false} comptoir />
    </div>
  );
}
