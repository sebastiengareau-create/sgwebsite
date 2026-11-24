import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lirePlanEntrepot, lireSeuilsPneus, emplacementsOccupes } from "@/lib/pneus";
import { courrielConfigure } from "@/lib/courrielDocuments";
import EnTete from "../../components/EnTete";
import { exigerAccesPneus, simple } from "../acces";
import JeuClient from "./JeuClient";

// Fiche d'un jeu de pneus : où il est, son état pneu par pneu, gestes
// (sortir, entreposer, déplacer, remettre), photos, reçu d'entreposage,
// étiquettes à code QR et historique. Le QR des étiquettes mène ici.
export default async function FicheJeu(props) {
  const session = await exigerAccesPneus();
  const { id } = await props.params;
  const jeu = await prisma.jeuPneus.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, nom: true, telephone: true, courriel: true, vehicules: { select: { id: true, annee: true, marque: true, modele: true, version: true, plaque: true } } } },
      vehicule: { select: { id: true, annee: true, marque: true, modele: true, version: true, plaque: true } },
      mouvements: { orderBy: { date: "desc" }, include: { bon: { select: { id: true, numero: true } } } },
      photos: { orderBy: { ajouteeLe: "asc" }, select: { id: true, ajouteeLe: true, employeNom: true } },
    },
  });
  if (!jeu) notFound();
  // Les autres jeux du même véhicule (ou du client, sans véhicule précisé)
  const [autres, plan, seuils, occupes] = await Promise.all([
    prisma.jeuPneus.findMany({
      where: { id: { not: jeu.id }, clientId: jeu.clientId, statut: { not: "REMIS" }, ...(jeu.vehiculeId && { vehiculeId: jeu.vehiculeId }) },
      select: { id: true, numero: true, saison: true, dimension: true, statut: true, emplacement: true },
    }),
    lirePlanEntrepot(), lireSeuilsPneus(), emplacementsOccupes(),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <JeuClient
        jeuInitial={simple(jeu)} autres={autres} plan={plan} seuils={seuils} courrielPret={courrielConfigure()}
        occupes={occupes.filter((e) => e !== jeu.emplacement || jeu.statut !== "ENTREPOSE")}
      />
    </div>
  );
}
