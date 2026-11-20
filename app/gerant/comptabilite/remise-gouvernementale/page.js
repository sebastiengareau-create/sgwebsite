import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import EnTete from "../../../components/EnTete";
import RemiseGouvernementaleClient from "./RemiseGouvernementaleClient";

// Le FSS et la CNESST se versent à Revenu Québec avec les retenues à la
// source ; la cotisation aux normes du travail, une fois l'an avec le
// sommaire des retenues (dernier jour de février).
// Les retenues propres aux employés (lib/retenuesPaie.js) se remettent ici
// aussi, même si elles ne vont pas à un gouvernement : le REER au régime de
// retraite, l'assurance collective et les autres retenues à l'assureur ou
// au bénéficiaire.
// groupe = clé de regroupement (un paiement séparé par groupe) ; titre = nom
// affiché, soit l'organisme qui perçoit. La TPS/TVQ est perçue par Revenu
// Québec, mais se paie à part des retenues à la source (DAS) provinciales.
const COMPTES_REMISE = [
  { numero: "2050", nom: "Impôt fédéral à payer", groupe: "ARC", titre: "ARC" },
  { numero: "2040", nom: "Assurance-emploi à payer", groupe: "ARC", titre: "ARC" },
  { numero: "2060", nom: "Impôt Québec à payer", groupe: "Revenu Québec", titre: "Revenu Québec" },
  { numero: "2020", nom: "RRQ à payer", groupe: "Revenu Québec", titre: "Revenu Québec" },
  { numero: "2030", nom: "RQAP à payer", groupe: "Revenu Québec", titre: "Revenu Québec" },
  { numero: "2080", nom: "FSS à payer", groupe: "Revenu Québec", titre: "Revenu Québec" },
  { numero: "2090", nom: "CNESST à payer", groupe: "Revenu Québec", titre: "Revenu Québec" },
  { numero: "2085", nom: "Normes du travail à payer", groupe: "Normes du travail", titre: "Revenu Québec", precision: "Normes du travail (annuel)" },
  { numero: "2095", nom: "REER des employés à remettre", groupe: "REER des employés", titre: "Régime de retraite", precision: "REER des employés" },
  { numero: "2096", nom: "Autres retenues des employés à remettre", groupe: "Autres retenues des employés", titre: "Assureur ou autre", precision: "Assurance collective et autres retenues" },
  { numero: "2000", nom: "TPS à payer", groupe: "TPS/TVQ", titre: "Revenu Québec", precision: "TPS/TVQ" },
  { numero: "2010", nom: "TVQ à payer", groupe: "TPS/TVQ", titre: "Revenu Québec", precision: "TPS/TVQ" },
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
