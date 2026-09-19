import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerComptesTresorerie, obtenirComptesTresorerieAvecSoldes, obtenirTransactionsTresorerie } from "@/lib/tresorerie";
import EnTete from "../../../../components/EnTete";
import TransactionsClient from "./TransactionsClient";

export default async function TransactionsTresorerie() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerComptesTresorerie();
  const comptes = await obtenirComptesTresorerieAvecSoldes({ actifSeulement: false });
  const transactions = await obtenirTransactionsTresorerie(comptes);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <TransactionsClient comptes={comptes} transactions={transactions} />
    </div>
  );
}
