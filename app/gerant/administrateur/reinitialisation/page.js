import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import ReinitialisationClient from "./ReinitialisationClient";

export default async function Reinitialisation() {
  const session = await obtenirSession();
  if (!session) redirect("/login");

  if (session.role !== "DEVELOPPEUR") {
    const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
    if (!utilisateur?.estSuperAdmin) redirect("/gerant");
  }

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ReinitialisationClient />
    </div>
  );
}
