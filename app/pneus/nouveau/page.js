import { prisma } from "@/lib/prisma";
import { lirePlanEntrepot, lireSeuilsPneus, emplacementsOccupes } from "@/lib/pneus";
import EnTete from "../../components/EnTete";
import { exigerAccesPneus, simple } from "../acces";
import FormulaireJeu from "./FormulaireJeu";

// Inscrire un jeu de pneus : à l'entrepôt, ou posé sur le véhicule (pour
// suivre le jeu de l'autre saison). ?client=…&vehicule=…&emplacement=…
// préremplit (une place libre touchée sur le plan) ; ?bon=… revient au bon
// une fois inscrit.
export default async function NouveauJeu(props) {
  const session = await exigerAccesPneus();
  const params = await props.searchParams;
  const [plan, seuils, occupes, clients] = await Promise.all([lirePlanEntrepot(), lireSeuilsPneus(), emplacementsOccupes(), prisma.client.findMany({
    select: {
      id: true, nom: true, numero: true, telephone: true,
      vehicules: { select: { id: true, annee: true, marque: true, modele: true, version: true, plaque: true }, orderBy: { creeLe: "desc" } },
    },
    orderBy: { nom: "asc" },
  })]);
  const clientId = clients.some((c) => c.id === params.client) ? params.client : "";
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <FormulaireJeu
        clients={simple(clients)} clientInitial={clientId}
        vehiculeInitial={typeof params.vehicule === "string" ? params.vehicule : ""}
        bonRetour={typeof params.bon === "string" ? params.bon : ""}
        emplacementInitial={typeof params.emplacement === "string" ? params.emplacement.slice(0, 30) : ""}
        plan={plan} seuils={seuils} occupes={occupes}
      />
    </div>
  );
}
