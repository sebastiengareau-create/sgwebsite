import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { peutGererElevage, lieuxConnus } from "@/lib/elevage";
import { chargerRegistre } from "@/lib/registreElevageDonnees";
import EnTete from "../../components/EnTete";
import RegistreClient from "./RegistreClient";

// Registre de l'élevage : journal des naissances, arrivées, déplacements,
// remplacements de boucle et sorties, à déclarer à Agri-Traçabilité Québec
export default async function Registre() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererElevage(session))) redirect("/mecanicien");

  const [{ betes, evenements }, lieux] = await Promise.all([chargerRegistre(), lieuxConnus()]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RegistreClient betes={JSON.parse(JSON.stringify(betes))} evenements={JSON.parse(JSON.stringify(evenements))} lieux={lieux} />
    </div>
  );
}
