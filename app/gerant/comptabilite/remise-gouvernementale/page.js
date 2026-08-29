import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import EnTete from "../../../components/EnTete";
import RemiseGouvernementaleClient from "./RemiseGouvernementaleClient";

const COMPTES_REMISE = [
  { numero: "2050", nom: "Impôt fédéral à payer", groupe: "ARC" },
  { numero: "2040", nom: "Assurance-emploi à payer", groupe: "ARC" },
  { numero: "2060", nom: "Impôt Québec à payer", groupe: "Revenu Québec" },
  { numero: "2020", nom: "RRQ à payer", groupe: "Revenu Québec" },
  { numero: "2030", nom: "RQAP à payer", groupe: "Revenu Québec" },
  { numero: "2000", nom: "TPS à payer", groupe: "TPS/TVQ" },
  { numero: "2010", nom: "TVQ à payer", groupe: "TPS/TVQ" },
];

export default async function RemiseGouvernementale() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerPlanComptable();

  const comptes = await prisma.compte.findMany({
    where: { numero: { in: COMPTES_REMISE.map((c) => c.numero) } },
    include: { lignes: true },
  });

  const soldes = COMPTES_REMISE.map((c) => {
    const compte = comptes.find((co) => co.numero === c.numero);
    const solde = compte ? compte.lignes.reduce((s, l) => s + l.credit - l.debit, 0) : 0;
    return { ...c, solde };
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RemiseGouvernementaleClient soldes={soldes} />
    </div>
  );
}
