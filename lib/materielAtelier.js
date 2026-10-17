// Matériel d'atelier (profil materielAtelierParHeure, voir lib/client.js) :
// une ligne au bas de la facture, heures de main-d'œuvre facturées × le
// montant par heure du profil. Elle s'ajoute au sous-total avant escompte et
// taxes, est figée sur la facture (Facture.totalMaterielAtelier) et va au
// compte 4060 Autres revenus. Client et serveur.
import { CLIENT } from "./client";

export const LIBELLE_MATERIEL_ATELIER = "Matériel d'atelier";
export const TAUX_MATERIEL_ATELIER = CLIENT.materielAtelierParHeure || 0;

export function montantMaterielAtelier(heures) {
  return Math.round((heures || 0) * TAUX_MATERIEL_ATELIER * 100) / 100;
}
