import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesPaieActif } from "@/lib/accesPaie";
import { versFormulaire, partiesDuReleve, verifier } from "@/lib/releveEmploi";
import { formaterNas, nasValide } from "@/lib/nas";
import EnTete from "../../../../components/EnTete";
import FormulaireReleve from "./FormulaireReleve";

export const metadata = { title: "Relevé d'emploi" };

export default async function PageReleveEmploi(props) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) redirect("/gerant");
  const { id } = await props.params;
  const enregistre = await prisma.releveEmploi.findUnique({ where: { id } });
  if (!enregistre) notFound();
  const releve = versFormulaire(enregistre);
  const parties = await partiesDuReleve(releve.employeId);
  const { employe, employeur } = parties;

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <Link href="/gerant/paie/releves-emploi" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Relevés d&apos;emploi</Link>
        <FormulaireReleve
          initial={JSON.parse(JSON.stringify(releve))}
          erreursInitiales={verifier(releve, parties)}
          employe={{
            id: employe.id, nom: employe.nom, prenom: employe.prenom, nomFamille: employe.nomFamille,
            nas: nasValide(employe.nas) ? formaterNas(employe.nas) : "", adresse: [employe.adresse, [employe.ville, employe.province, employe.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(", "),
          }}
          employeur={{ nom: employeur.nom, bn: employeur.bn, contact: [employeur.contactPrenom, employeur.contactNom].filter(Boolean).join(" "), telephone: employeur.indicatif ? `${employeur.indicatif} ${employeur.telephone7.slice(0, 3)}-${employeur.telephone7.slice(3)}` : "" }}
        />
      </div>
    </div>
  );
}
