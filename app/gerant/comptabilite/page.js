import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import EnTete from "../../components/EnTete";
import PlanComptableClient from "./PlanComptableClient";

const NORMAL_DEBIT = ["ACTIF", "DEPENSE"]; // ces types augmentent au débit
const LABELS_TYPE = { ACTIF: "Actif", PASSIF: "Passif", CAPITAUX_PROPRES: "Capitaux propres", REVENU: "Revenus", DEPENSE: "Dépenses" };

export default async function Comptabilite() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerPlanComptable(); // crée le plan standard au besoin, sans dupliquer

  const comptes = await prisma.compte.findMany({
    where: { actif: true },
    include: { lignes: true },
    orderBy: { numero: "asc" },
  });

  const comptesAvecSolde = comptes.map((c) => {
    const totalDebit = c.lignes.reduce((s, l) => s + l.debit, 0);
    const totalCredit = c.lignes.reduce((s, l) => s + l.credit, 0);
    const solde = NORMAL_DEBIT.includes(c.type) ? totalDebit - totalCredit : totalCredit - totalDebit;
    return { id: c.id, numero: c.numero, nom: c.nom, type: c.type, solde, nbEcritures: c.lignes.length };
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PlanComptableClient comptes={comptesAvecSolde} labelsType={LABELS_TYPE} />
    </div>
  );
}
