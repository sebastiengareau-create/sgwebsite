import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { refusPneus } from "@/lib/pneus";

// Pages de l'entreposage de pneus : connecté, module actif et accès
// « Entreposage de pneus » (Rôles et accès)
export async function exigerAccesPneus() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (await refusPneus(session)) redirect("/mecanicien");
  return session;
}

// Données Prisma → objets simples pour un composant client
export const simple = (x) => JSON.parse(JSON.stringify(x));

// Champs du client et du véhicule montrés avec un jeu
export const AVEC_CLIENT_VEHICULE = {
  client: { select: { id: true, nom: true, telephone: true, courriel: true, promotionsRefuseesLe: true } },
  vehicule: { select: { id: true, annee: true, marque: true, modele: true, version: true, plaque: true } },
};
