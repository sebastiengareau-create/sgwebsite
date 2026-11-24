import { prisma } from "@/lib/prisma";
import { aAccesSection } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { lireReglagesPneus } from "@/lib/pneus";
import { courrielConfigure } from "@/lib/courrielDocuments";
import EnTete from "../components/EnTete";
import { exigerAccesPneus, simple, AVEC_CLIENT_VEHICULE } from "./acces";
import PneusClient from "./PneusClient";

// Entreposage de pneus (lib/pneus.js) : avancement de la saison, plan de
// l'entrepôt, jeux à l'entrepôt et sur les véhicules, rappels de changement
// de saison, jeux à remplacer et oubliés, et les réglages (prix, plan,
// seuils de l'état, conditions du reçu)
export default async function PagePneus() {
  const session = await exigerAccesPneus();
  const [jeux, reglages, peutRegler, { nomEntreprise }] = await Promise.all([
    prisma.jeuPneus.findMany({
      include: {
        ...AVEC_CLIENT_VEHICULE,
        // Dernière entrée ou sortie : avancement de la saison, jeux oubliés
        mouvements: { where: { type: { in: ["ENTREE", "SORTIE"] } }, orderBy: { date: "desc" }, take: 1, select: { type: true, date: true } },
      },
      orderBy: { numero: "asc" },
    }),
    lireReglagesPneus(),
    aAccesSection(session, "parametres"),
    obtenirInfosEntreprise(),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PneusClient jeux={simple(jeux)} reglages={reglages} peutRegler={peutRegler} nomEntreprise={nomEntreprise} courrielPret={courrielConfigure()} />
    </div>
  );
}
