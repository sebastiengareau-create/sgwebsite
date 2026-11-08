import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { peutGererCopro } from "@/lib/copropriete";

// Pages de la copropriété : connecté, module actif et accès « Copropriété »
export async function exigerAccesCopro() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererCopro(session))) redirect("/mecanicien");
  return session;
}

// Données Prisma → objets simples pour un composant client
export const simple = (x) => JSON.parse(JSON.stringify(x));

// Champs d'un fichier sans son contenu (jamais envoyé à la page)
export const SANS_DONNEES = { id: true, nom: true, typeMime: true, taille: true, creeLe: true, ajoutePar: true };
