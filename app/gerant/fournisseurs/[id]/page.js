import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import EnTete from "../../../components/EnTete";
import FournisseurDetailClient from "./FournisseurDetailClient";

export default async function FicheFournisseur(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) redirect("/gerant");

  const fournisseur = await prisma.fournisseur.findUnique({
    where: { id: params.id },
    include: { depenses: { orderBy: { dateFacture: "desc" }, take: 20 } },
  });
  if (!fournisseur) notFound();

  // Solde calculé sur toutes les impayées, pas seulement les 20 affichées
  const impayees = await prisma.depense.aggregate({
    where: { fournisseurId: fournisseur.id, statut: "IMPAYEE" },
    _sum: { montant: true }, _count: true,
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <FournisseurDetailClient fournisseur={fournisseur} soldeDu={impayees._sum.montant || 0} nbImpayees={impayees._count} />
    </div>
  );
}
