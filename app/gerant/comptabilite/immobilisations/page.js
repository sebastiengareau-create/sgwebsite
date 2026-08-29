import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import EnTete from "../../../components/EnTete";
import ImmobilisationsClient from "./ImmobilisationsClient";

export default async function Immobilisations() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerPlanComptable();

  const [immobilisations, amortissements] = await Promise.all([
    prisma.immobilisation.findMany({ orderBy: { dateAcquisition: "desc" } }),
    prisma.amortissementMensuel.findMany({ orderBy: { mois: "desc" }, take: 12 }),
  ]);

  // Amortissement cumulé à ce jour, calculé par immobilisation (linéaire,
  // au prorata du nombre de mois écoulés depuis l'acquisition)
  const maintenant = new Date();
  const avecValeurNette = immobilisations.map((im) => {
    const moisEcoules = Math.max(0, (maintenant.getFullYear() - im.dateAcquisition.getFullYear()) * 12 + (maintenant.getMonth() - im.dateAcquisition.getMonth()));
    const baseAmortissable = Math.max(0, im.coutAcquisition - im.valeurResiduelle);
    const amortissementMensuel = baseAmortissable / im.dureeVieAns / 12;
    const amortissementCumule = Math.min(baseAmortissable, amortissementMensuel * moisEcoules);
    const valeurNette = im.coutAcquisition - amortissementCumule;
    return { ...im, amortissementMensuel, amortissementCumule, valeurNette };
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <ImmobilisationsClient immobilisations={avecValeurNette} amortissements={amortissements} />
    </div>
  );
}
