import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import EnTete from "../../components/EnTete";
import FournisseursClient from "./FournisseursClient";

export default async function GestionFournisseurs() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) redirect("/gerant");

  const fournisseurs = await prisma.fournisseur.findMany({
    include: { _count: { select: { depenses: true } } },
    orderBy: { nom: "asc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <FournisseursClient fournisseurs={fournisseurs} />
    </div>
  );
}
