import { redirect, notFound } from "next/navigation";
import { obtenirSession, aAccesSection, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { limitesMoisQuebec } from "@/lib/temps";
import { calculerResumeFermeture } from "@/lib/rapportsComptables";
import { obtenirChecklist } from "@/lib/checklistFermeture";
import EnTete from "../../../../../components/EnTete";
import AssistantFermetureClient from "./AssistantFermetureClient";

export default async function AssistantFermeture({ params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const annee = Number(params.annee);
  const mois = Number(params.mois);
  if (!annee || !mois || mois < 1 || mois > 12) notFound();

  const { debut, fin } = limitesMoisQuebec(annee, mois);

  const [periode, resume, checklist] = await Promise.all([
    prisma.periodeComptable.findUnique({ where: { annee_mois: { annee, mois } } }),
    calculerResumeFermeture({ debut, fin }),
    obtenirChecklist(annee, mois),
  ]);

  const statut = periode?.statut || "OUVERTE";

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <AssistantFermetureClient
        annee={annee}
        mois={mois}
        statut={statut}
        statutParNom={periode?.statutParNom || null}
        statutLe={periode?.statutLe || null}
        resume={resume}
        checklist={checklist}
        estGerantOuDev={estGerantOuDev(session)}
      />
    </div>
  );
}
