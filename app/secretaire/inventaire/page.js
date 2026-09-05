import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { assurerPlanComptable, assurerCategoriesInventaire } from "@/lib/comptabilite";
import EnTete from "../../components/EnTete";
import InventaireClient from "./InventaireClient";

export default async function GestionInventaire() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) redirect("/mecanicien");

  await assurerPlanComptable();
  await assurerCategoriesInventaire();

  const [pieces, categories, comptesRevenu] = await Promise.all([
    prisma.piece.findMany({ orderBy: { nom: "asc" } }),
    prisma.categorieInventaire.findMany({ orderBy: [{ actif: "desc" }, { nom: "asc" }] }),
    prisma.compte.findMany({ where: { type: "REVENU", actif: true }, orderBy: { numero: "asc" } }),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <InventaireClient pieces={pieces} categories={categories} comptesRevenu={comptesRevenu} peutGererCategories={estGerantOuDev(session)} />
    </div>
  );
}
