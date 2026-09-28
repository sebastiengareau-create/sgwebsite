import { redirect, notFound } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CODE_CATEGORIE_INVENTAIRE } from "@/lib/comptabilite";
import { obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import EnTete from "../../../../components/EnTete";
import DepenseDetailClient from "./DepenseDetailClient";

// Fiche d'une facture fournisseur (compte à payer) — ouverte en touchant
// une facture dans Comptes à payer, la fiche fournisseur ou le rapport.
export default async function FicheDepense(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) redirect("/gerant");

  const depense = await prisma.depense.findUnique({
    where: { id: params.id },
    include: {
      fournisseur: true,
      compteTresorerie: true,
      lignes: { include: { categorieDepense: true, piece: { select: { id: true, nom: true, numero: true } } } },
    },
  });
  if (!depense) notFound();

  const [fournisseurs, categoriesBrutes, parametres, comptesTresorerie, autresImpayees] = await Promise.all([
    prisma.fournisseur.findMany({ where: { OR: [{ actif: true }, { id: depense.fournisseurId }] }, orderBy: { nom: "asc" } }),
    prisma.categorieDepense.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.parametre.findMany({ where: { cle: { in: ["tps_taux", "tvq_taux"] } } }),
    obtenirComptesTresoreriePourSelection(),
    prisma.depense.findMany({
      where: { fournisseurId: depense.fournisseurId, statut: "IMPAYEE", id: { not: depense.id } },
      select: { id: true, description: true, montant: true, dateFacture: true, dateEcheance: true, statut: true },
      orderBy: { dateFacture: "asc" },
    }),
  ]);
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const categories = categoriesBrutes.filter((c) => c.code !== CODE_CATEGORIE_INVENTAIRE);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <DepenseDetailClient
        depense={depense} fournisseurs={fournisseurs} categories={categories} comptesTresorerie={comptesTresorerie}
        tpsTaux={Number(dict.tps_taux || 5)} tvqTaux={Number(dict.tvq_taux || 9.975)} autresImpayees={autresImpayees}
      />
    </div>
  );
}
