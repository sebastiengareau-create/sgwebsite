import { obtenirSession, estGerantOuDev, aAccesSection, estDeveloppeur } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { assurerPlanComptable, assurerCategoriesInventaire, calculerAlignementInventaire } from "@/lib/comptabilite";
import { quantitesEnCommande } from "@/lib/commandesFournisseurs";
import { obtenirInfosEntreprise } from "@/lib/config";
import EnTete from "../../components/EnTete";
import InventaireClient from "./InventaireClient";

export default async function GestionInventaire() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) redirect("/mecanicien");

  await assurerPlanComptable();
  await assurerCategoriesInventaire();

  const moduleCompta = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  const alignement = moduleCompta?.valeur === "inactif" ? null : await calculerAlignementInventaire();

  const [pieces, categories, comptesRevenu, fournisseurs, enCommande] = await Promise.all([
    prisma.piece.findMany({
      include: { fournisseurs: { select: { numeroFournisseur: true, fournisseurId: true, fournisseur: { select: { nom: true } } } } },
      orderBy: { nom: "asc" },
    }),
    prisma.categorieInventaire.findMany({ orderBy: [{ actif: "desc" }, { nom: "asc" }] }),
    prisma.compte.findMany({ where: { type: "REVENU", actif: true }, orderBy: { numero: "asc" } }),
    prisma.fournisseur.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    quantitesEnCommande(prisma),
  ]);
  const { nomEntreprise } = await obtenirInfosEntreprise();

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <InventaireClient pieces={pieces} enCommande={enCommande} nomEntreprise={nomEntreprise} categories={categories} comptesRevenu={comptesRevenu} fournisseurs={fournisseurs} alignement={alignement} peutGererCategories={estGerantOuDev(session)} peutImporter={estDeveloppeur(session)} />
    </div>
  );
}
