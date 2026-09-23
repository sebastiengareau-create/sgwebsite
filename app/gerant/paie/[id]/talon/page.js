import { notFound, redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import BoutonImprimerRapport from "../../../comptabilite/rapports/BoutonImprimerRapport";
import TalonPaie from "../../TalonPaie";

export default async function TalonDePaie(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/login");

  const entreprise = await obtenirInfosEntreprise();

  const paie = await prisma.paie.findUnique({ where: { id: params.id }, include: { employe: true } });
  if (!paie) notFound();

  // Cumulatifs de l'année — toutes les paies non corrigées de cet employé,
  // pour l'année de cette paie précise, jusqu'à et incluant celle-ci
  const anneeCourante = new Date(paie.periodeFin).getFullYear();
  const paiesAnnee = await prisma.paie.findMany({
    where: {
      employeId: paie.employeId,
      statut: "VERSEE",
      periodeFin: { gte: new Date(`${anneeCourante}-01-01`), lte: paie.periodeFin },
    },
  });

  const cumulatif = paiesAnnee.reduce(
    (acc, p) => ({
      brut: acc.brut + p.salaireBrut,
      rrq: acc.rrq + p.rrqEmploye,
      rqap: acc.rqap + p.rqapEmploye,
      ae: acc.ae + p.aeEmploye,
      impotFederal: acc.impotFederal + p.impotFederal,
      impotQuebec: acc.impotQuebec + p.impotQuebec,
      net: acc.net + p.salaireNet,
      heures: acc.heures + p.heuresTravaillees,
    }),
    { brut: 0, rrq: 0, rqap: 0, ae: 0, impotFederal: 0, impotQuebec: 0, net: 0, heures: 0 }
  );

  return (
    <div>
      <style>{`
        @media print { .cacher-impression { display: none !important; } body { background: white !important; } }
        body { background: #f2f0ea; margin: 0; }
      `}</style>
      <div className="cacher-impression" style={{ padding: 16, textAlign: "center" }}>
        <BoutonImprimerRapport />
      </div>

      <TalonPaie paie={paie} cumulatif={cumulatif} anneeCourante={anneeCourante} entreprise={entreprise} />
    </div>
  );
}
