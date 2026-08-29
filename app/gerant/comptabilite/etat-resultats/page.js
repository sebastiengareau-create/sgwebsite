import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import EnTete from "../../../components/EnTete";
import EtatResultatsClient from "./EtatResultatsClient";

export default async function EtatResultats() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerPlanComptable();

  const comptes = await prisma.compte.findMany({
    where: { actif: true, type: { in: ["REVENU", "DEPENSE"] } },
    include: { lignes: true },
    orderBy: { numero: "asc" },
  });

  const lignes = comptes.map((c) => {
    const totalDebit = c.lignes.reduce((s, l) => s + l.debit, 0);
    const totalCredit = c.lignes.reduce((s, l) => s + l.credit, 0);
    const solde = c.type === "REVENU" ? totalCredit - totalDebit : totalDebit - totalCredit;
    return { numero: c.numero, nom: c.nom, type: c.type, solde };
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EtatResultatsClient lignes={lignes} />
    </div>
  );
}
