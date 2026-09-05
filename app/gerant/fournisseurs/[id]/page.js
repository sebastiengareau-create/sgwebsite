import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import EnTete from "../../../components/EnTete";
import FournisseurDetailClient from "./FournisseurDetailClient";

export default async function FicheFournisseur({ params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) redirect("/gerant");

  const fournisseur = await prisma.fournisseur.findUnique({
    where: { id: params.id },
    include: { depenses: { orderBy: { dateFacture: "desc" }, take: 20 } },
  });
  if (!fournisseur) notFound();

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <FournisseurDetailClient fournisseur={fournisseur} />
    </div>
  );
}
