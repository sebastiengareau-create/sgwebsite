// Indicateurs de productivité (Productivité par employés). Serveur seulement.

import { dateQuebecStr } from "./temps";
import { prisma } from "./prisma";
import { lireParametre } from "@/lib/parametres";

// Module Productivité par employés (Administrateur → Modules) : actif tant
// que le super-administrateur ne le désactive pas — offert ou non au client.
// Couvre le rapport de productivité (/gerant/rapports) et la rentabilité par
// employé (/gerant/rapports/rentabilite). L'horodateur, lui, reste toujours.
export const CLE_MODULE_PRODUCTIVITE = "module_productivite";

export async function productiviteActif() {
  return (await lireParametre(CLE_MODULE_PRODUCTIVITE)) !== "inactif";
}

// ---------------------------------------------------------------------------
// Poinçons oubliés : un poinçon (sur un bon ou une tâche interne) est
// suspect s'il dure plus de SEUIL_POINCON_OUBLIE_HEURES, ou s'il déborde sur
// un autre jour (commencé un jour, terminé — ou toujours ouvert — le
// lendemain ou plus tard). Un poinçon encore ouvert compte jusqu'à maintenant.
export const SEUIL_POINCON_OUBLIE_HEURES = 10;

// Combien de jours en arrière chercher les poinçons déjà fermés mais suspects
export const JOURS_POINCONS_OUBLIES = 7;

export function estPoinconSuspect(entree, maintenant = new Date()) {
  const fin = entree.fin ? new Date(entree.fin) : maintenant;
  const heures = (fin - new Date(entree.debut)) / 3600000;
  return heures > SEUIL_POINCON_OUBLIE_HEURES || dateQuebecStr(entree.debut) !== dateQuebecStr(fin);
}
