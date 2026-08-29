import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import EnTete from "../../../components/EnTete";
import BilanClient from "./BilanClient";

const NORMAL_DEBIT = ["ACTIF", "DEPENSE"];

export default async function Bilan() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerPlanComptable();

  const comptes = await prisma.compte.findMany({
    where: { actif: true },
    include: { lignes: true },
    orderBy: { numero: "asc" },
  });

  const soldeCompte = (c) => {
    const totalDebit = c.lignes.reduce((s, l) => s + l.debit, 0);
    const totalCredit = c.lignes.reduce((s, l) => s + l.credit, 0);
    return NORMAL_DEBIT.includes(c.type) ? totalDebit - totalCredit : totalCredit - totalDebit;
  };

  const lignes = comptes.map((c) => ({ numero: c.numero, nom: c.nom, type: c.type, solde: soldeCompte(c) }));

  // Comme il n'y a pas de vraie "clôture" de fin d'année qui transfère les
  // revenus/dépenses vers les capitaux propres, on ajoute le résultat net
  // cumulé directement dans les capitaux propres pour que le bilan
  // s'équilibre correctement (Actif = Passif + Capitaux propres)
  const totalRevenus = lignes.filter((l) => l.type === "REVENU").reduce((s, l) => s + l.solde, 0);
  const totalDepenses = lignes.filter((l) => l.type === "DEPENSE").reduce((s, l) => s + l.solde, 0);
  const resultatNetCumule = totalRevenus - totalDepenses;

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <BilanClient lignes={lignes} resultatNetCumule={resultatNetCumule} />
    </div>
  );
}
