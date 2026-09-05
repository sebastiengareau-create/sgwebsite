import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import NouveauBonForm from "./NouveauBonForm";

export default async function NouveauBonPage() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/login");
  const clients = await prisma.client.findMany({ orderBy: { nom: "asc" }, include: { vehicules: true } });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <NouveauBonForm clientsExistants={clients} />
    </div>
  );
}
