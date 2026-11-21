import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { lireParametre } from "@/lib/parametres";
import { inspectionActive, lireGrilles, CLE_GRILLES } from "@/lib/inspections";
import EnTete from "../../../components/EnTete";
import EditeurGrilles from "./EditeurGrilles";

// Paramètres → Grilles d'inspection : les grilles que le technicien choisit
// en commençant une inspection sur un bon (lib/grillesInspection.js)
export default async function PageGrillesInspection() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) redirect("/gerant");
  if (!(await inspectionActive())) redirect("/gerant/parametres");

  const [grilles, reglage] = await Promise.all([lireGrilles(), lireParametre(CLE_GRILLES)]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EditeurGrilles grillesInitiales={grilles} personnalisees={!!reglage} />
    </div>
  );
}
