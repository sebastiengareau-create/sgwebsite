import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable, assurerCategoriesDepense, assurerCategorieInventairePieces, CODE_CATEGORIE_INVENTAIRE } from "@/lib/comptabilite";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import EnTete from "../../../components/EnTete";
import ComptesAPayerClient from "./ComptesAPayerClient";

export default async function ComptesAPayer() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "fournisseurs"))) redirect("/gerant");

  await assurerPlanComptable();
  await assurerCategoriesDepense();
  await assurerCategorieInventairePieces();
  await assurerComptesTresorerie();

  const [fournisseurs, categoriesBrutes, comptesDepense, depenses, parametres, comptesTresorerie, pieces] = await Promise.all([
    prisma.fournisseur.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.categorieDepense.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.compte.findMany({ where: { type: "DEPENSE", actif: true }, orderBy: { numero: "asc" } }),
    prisma.depense.findMany({ include: { fournisseur: true, lignes: { include: { categorieDepense: true } } }, orderBy: { dateFacture: "desc" }, take: 50 }),
    prisma.parametre.findMany({ where: { cle: { in: ["tps_taux", "tvq_taux"] } } }),
    obtenirComptesTresoreriePourSelection(),
    prisma.piece.findMany({ select: { id: true, nom: true, numero: true, qte: true }, orderBy: { nom: "asc" } }),
  ]);
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  // Le poste "Réception d'inventaire" est assigné automatiquement quand une
  // ligne est liée à une pièce — jamais choisi manuellement dans la liste.
  const categorieInventaire = categoriesBrutes.find((c) => c.code === CODE_CATEGORIE_INVENTAIRE);
  const categories = categoriesBrutes.filter((c) => c.code !== CODE_CATEGORIE_INVENTAIRE);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ComptesAPayerClient
        fournisseurs={fournisseurs} categories={categories} comptesDepense={comptesDepense} depenses={depenses}
        tpsTaux={Number(dict.tps_taux || 5)} tvqTaux={Number(dict.tvq_taux || 9.975)}
        comptesTresorerie={comptesTresorerie} pieces={pieces} categorieInventaireId={categorieInventaire?.id}
      />
    </div>
  );
}
