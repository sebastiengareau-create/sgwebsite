import { prisma } from "@/lib/prisma";
import { aAccesSection } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { lirePrixSaison } from "@/lib/pneus";
import { courrielConfigure } from "@/lib/courrielDocuments";
import EnTete from "../components/EnTete";
import { exigerAccesPneus, simple, AVEC_CLIENT_VEHICULE } from "./acces";
import PneusClient from "./PneusClient";

// Entreposage de pneus (lib/pneus.js) : l'entrepôt par emplacement, les
// jeux posés sur les véhicules, les rappels de changement de saison et le
// prix de l'entreposage
export default async function PagePneus() {
  const session = await exigerAccesPneus();
  const [jeux, prixSaison, peutRegler, { nomEntreprise }] = await Promise.all([
    prisma.jeuPneus.findMany({ include: AVEC_CLIENT_VEHICULE, orderBy: { numero: "asc" } }),
    lirePrixSaison(),
    aAccesSection(session, "parametres"),
    obtenirInfosEntreprise(),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PneusClient
        jeux={simple(jeux)} prixSaison={prixSaison} peutRegler={peutRegler}
        nomEntreprise={nomEntreprise} courrielPret={courrielConfigure()}
      />
    </div>
  );
}
