import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import EnTete from "../../../components/EnTete";
import FournisseurDetailClient from "./FournisseurDetailClient";
import { voisinsFiche } from "@/lib/navigationFiches";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import NavigationFiches from "../../../components/NavigationFiches";

export default async function FicheFournisseur(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) redirect("/gerant");

  const fournisseur = await prisma.fournisseur.findUnique({
    where: { id: params.id },
    include: { depenses: { orderBy: { dateFacture: "desc" }, take: 20 } },
  });
  if (!fournisseur) notFound();

  const ordre = await prisma.fournisseur.findMany({ select: { id: true }, orderBy: { nom: "asc" } });

  // Solde calculé sur toutes les impayées, pas seulement les 20 affichées
  const impayees = await prisma.depense.aggregate({
    where: { fournisseurId: fournisseur.id, statut: "IMPAYEE" },
    _sum: { montant: true }, _count: true,
  });

  // En retard (échéance avant aujourd'hui, comme etatEcheance — les
  // échéances sont ancrées à midi UTC) et achats de l'année, sur toutes ses
  // factures
  const aujourdhui = dateAujourdhuiQuebec();
  const maintenant = new Date(`${aujourdhui}T12:00:00Z`);
  const debutAnnee = new Date(`${aujourdhui.slice(0, 4)}-01-01T00:00:00Z`);
  const [enRetard, achatsAnnee] = await Promise.all([
    prisma.depense.aggregate({
      where: { fournisseurId: fournisseur.id, statut: "IMPAYEE", dateEcheance: { lt: maintenant } },
      _sum: { montant: true }, _count: true,
    }),
    prisma.depense.aggregate({
      where: { fournisseurId: fournisseur.id, dateFacture: { gte: debutAnnee } },
      _sum: { montant: true }, _count: true,
    }),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <FournisseurDetailClient
        fournisseur={fournisseur} soldeDu={impayees._sum.montant || 0} nbImpayees={impayees._count}
        enRetard={enRetard._sum.montant || 0} nbEnRetard={enRetard._count}
        achatsAnnee={achatsAnnee._sum.montant || 0} nbAchatsAnnee={achatsAnnee._count}
      />
      <NavigationFiches cle="fournisseurs" idCourant={fournisseur.id} base="/gerant/fournisseurs" voisinsParDefaut={voisinsFiche(ordre.map((f) => f.id), fournisseur.id)} />
    </div>
  );
}
