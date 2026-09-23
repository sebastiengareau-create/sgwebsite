import { notFound, redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import BoutonImprimerRapport from "../../../../comptabilite/rapports/BoutonImprimerRapport";
import TalonPaie from "../../../TalonPaie";

export default async function TalonsDuLot(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/login");

  const entreprise = await obtenirInfosEntreprise();

  const lot = await prisma.lotPaie.findUnique({
    where: { id: params.id },
    include: { paies: { include: { employe: true } } },
  });
  if (!lot) notFound();

  // Seules les paies versées ont un talon — les brouillons n'ont rien à
  // imprimer et les corrigées sont remplacées par une nouvelle paie
  const paiesVersees = lot.paies
    .filter((p) => p.statut === "VERSEE")
    .sort((a, b) => a.employe.nom.localeCompare(b.employe.nom));
  if (paiesVersees.length === 0) notFound();

  // Même calcul de cumulatif annuel que le talon individuel, refait pour
  // chaque employé du lot
  const cumulatifs = await Promise.all(
    paiesVersees.map(async (paie) => {
      const anneeCourante = new Date(paie.periodeFin).getFullYear();
      const paiesAnnee = await prisma.paie.findMany({
        where: {
          employeId: paie.employeId,
          statut: "VERSEE",
          periodeFin: { gte: new Date(`${anneeCourante}-01-01`), lte: paie.periodeFin },
        },
      });
      return paiesAnnee.reduce(
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
    })
  );

  return (
    <div>
      <style>{`
        @media print {
          .cacher-impression { display: none !important; }
          body { background: white !important; }
          .talon-page + .talon-page { break-before: page; }
        }
        body { background: #f2f0ea; margin: 0; }
      `}</style>
      <div className="cacher-impression" style={{ padding: 16, textAlign: "center" }}>
        <BoutonImprimerRapport />
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          {paiesVersees.length} talon{paiesVersees.length !== 1 ? "s" : ""} — 1 par page
        </p>
      </div>

      {paiesVersees.map((paie, i) => (
        <TalonPaie
          key={paie.id}
          className="talon-page"
          paie={paie}
          cumulatif={cumulatifs[i]}
          anneeCourante={new Date(paie.periodeFin).getFullYear()}
          entreprise={entreprise}
        />
      ))}
    </div>
  );
}
