import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { exigerAccesPneus, simple } from "../acces";
import JeuClient from "./JeuClient";

// Fiche d'un jeu de pneus : où il est, gestes (sortir, entreposer,
// déplacer, remettre), étiquettes à code QR et historique. Le QR des
// étiquettes mène ici.
export default async function FicheJeu(props) {
  const session = await exigerAccesPneus();
  const { id } = await props.params;
  const jeu = await prisma.jeuPneus.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, nom: true, telephone: true, vehicules: { select: { id: true, annee: true, marque: true, modele: true, version: true, plaque: true } } } },
      vehicule: { select: { id: true, annee: true, marque: true, modele: true, version: true, plaque: true } },
      mouvements: { orderBy: { date: "desc" }, include: { bon: { select: { id: true, numero: true } } } },
    },
  });
  if (!jeu) notFound();
  // Les autres jeux du même véhicule (ou du client, sans véhicule précisé)
  const autres = await prisma.jeuPneus.findMany({
    where: { id: { not: jeu.id }, clientId: jeu.clientId, statut: { not: "REMIS" }, ...(jeu.vehiculeId && { vehiculeId: jeu.vehiculeId }) },
    select: { id: true, numero: true, saison: true, dimension: true, statut: true, emplacement: true },
  });
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <JeuClient jeuInitial={simple(jeu)} autres={autres} />
    </div>
  );
}
