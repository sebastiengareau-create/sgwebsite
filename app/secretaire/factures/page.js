import { obtenirSession, aAccesSection } from "@/lib/auth";
import { facturesDuQuotidien, moisAnciensFactures, totauxFactures } from "@/lib/listeFactures";
import { redirect } from "next/navigation";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import EnTete from "../../components/EnTete";
import OperationsTabs from "../../components/OperationsTabs";
import FacturationPeriodes from "../../components/FacturationPeriodes";
import ResumeOperations from "../../components/ResumeOperations";
import FacturesClient from "./FacturesClient";

export default async function ListeFactures() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "operations"))) redirect("/mecanicien");

  // Factures du quotidien, plus le résumé des mois passés (leurs dossiers se
  // chargent à l'ouverture — voir lib/listeFactures.js)
  const [factures, moisAnciens, totaux] = await Promise.all([facturesDuQuotidien(), moisAnciensFactures(), totauxFactures()]);
  await assurerComptesTresorerie();
  const comptesTresorerie = await obtenirComptesTresoreriePourSelection();

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <OperationsTabs />
      <FacturationPeriodes />
      <ResumeOperations />
      <FacturesClient factures={factures} moisAnciens={moisAnciens} totaux={totaux} comptesTresorerie={comptesTresorerie} />
    </div>
  );
}
