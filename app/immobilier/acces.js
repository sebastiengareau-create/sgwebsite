import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { peutGererImmo } from "@/lib/immobilier";

// Pages de l'immobilier : connecté, module actif et accès « Immobilier »
export async function exigerAccesImmo() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererImmo(session))) redirect("/mecanicien");
  return session;
}

// Données Prisma → objets simples pour un composant client
export const simple = (x) => JSON.parse(JSON.stringify(x));

// Champs d'un document sans son contenu (jamais envoyé à la page)
export const DOC_SANS_DONNEES = { id: true, visibleLocataire: true, titre: true, categorie: true, date: true, expireLe: true, description: true, nom: true, typeMime: true, taille: true, creeLe: true, immeubleId: true, logementId: true, bailId: true, locataireId: true, genre: true, signeLe: true };
export const FICHIER_SANS_DONNEES = { id: true, nom: true, typeMime: true, taille: true, creeLe: true, ajoutePar: true };
