import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { bonsDuQuotidien, moisAnciensBons } from "@/lib/listeBons";
import EnTete from "../components/EnTete";
import OperationsTabs from "../components/OperationsTabs";
import FacturationPeriodes from "../components/FacturationPeriodes";
import ResumeOperations from "../components/ResumeOperations";
import ListeBonsClient from "./ListeBonsClient";

export default async function EspaceSecretaire(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await aAccesSection(session, "operations"))) redirect(`/${session.role.toLowerCase()}`);
  const filtre = searchParams?.statut;

  // Bons du quotidien, plus le nombre de bons facturés de chaque mois passé
  // (leurs dossiers se chargent à l'ouverture — voir lib/listeBons.js). Le
  // filtre (?statut=…) est appliqué côté client pour afficher le compte de
  // chaque catégorie, dont « Planifiés ».
  const [bons, moisAnciens] = await Promise.all([bonsDuQuotidien(), moisAnciensBons()]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <OperationsTabs />
      <FacturationPeriodes />
      <ResumeOperations />
      <ListeBonsClient bons={bons} moisAnciens={moisAnciens} filtreActuel={filtre} />
    </div>
  );
}
