import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import OperationsTabs from "../../../components/OperationsTabs";
import FacturationPeriodes from "../../../components/FacturationPeriodes";
import ResumeOperations from "../../../components/ResumeOperations";
import SoumissionsListe from "./SoumissionsListe";
import { reparerEcrituresFacturesSoumissions } from "@/lib/soumissions";

export default async function ListeSoumissions() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/login");
  await reparerEcrituresFacturesSoumissions(session.nom);
  const [soumissions, parametres] = await Promise.all([
    prisma.soumission.findMany({
      include: { taches: { include: { pieces: true } } },
      orderBy: { creeLe: "desc" },
    }),
    prisma.parametre.findMany(),
  ]);
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  // Soumissions facturées : la facture est-elle encore en vigueur ? Annulée
  // (ou supprimée), la soumission peut revenir en attente.
  const bonIdsFactures = soumissions.filter((s) => s.statut === "FACTUREE" && s.bonId).map((s) => s.bonId);
  const facturesEnVigueur = new Set((await prisma.facture.findMany({
    where: { bonId: { in: bonIdsFactures }, statut: { not: "ANNULEE" } },
    select: { bonId: true },
  })).map((f) => f.bonId));
  const soumissionsAvecFacture = soumissions.map((s) => ({ ...s, factureEnVigueur: s.statut === "FACTUREE" && facturesEnVigueur.has(s.bonId) }));
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);
  const tpsTaux = Number(dict.tps_taux || 5);
  const tvqTaux = Number(dict.tvq_taux || 9.975);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <OperationsTabs />
      <FacturationPeriodes />
      <ResumeOperations />
      <SoumissionsListe soumissions={soumissionsAvecFacture} tauxHoraireClient={tauxHoraireClient} tpsTaux={tpsTaux} tvqTaux={tvqTaux} />
    </div>
  );
}
