// Montant avant taxes d'un bon pas encore facturé, calculé comme le fera sa
// facture (app/api/bons/[id]/facturer) : pièces + main-d'œuvre (heures
// poinçonnées terminées × taux horaire) + autres revenus + fournitures
// d'atelier, moins l'escompte. Le bon doit inclure problemes → pieces et
// entreesTemps. Client et serveur.
import { totauxLignesFixes } from "./piecesSoumission";
import { heuresFacturablesTache } from "./kits";
import { montantMaterielAtelier } from "./materielAtelier";
import { montantEscompte } from "./escompte";

export function totalAvantTaxesBon(bon, tauxHoraireDefaut) {
  const tauxHoraire = bon.tauxHoraireOverride ?? tauxHoraireDefaut;
  const lignesFixes = totauxLignesFixes(bon.problemes);
  const totalPieces = lignesFixes.pieces + bon.problemes.reduce(
    (s, pr) => s + pr.pieces.reduce((s2, l) => s2 + l.qte * l.prix, 0),
    0
  );
  const heures = bon.problemes.reduce((s, pr) => s + heuresFacturablesTache(pr), 0);
  const sousTotal = totalPieces + heures * tauxHoraire + lignesFixes.autres + montantMaterielAtelier(heures);
  return sousTotal - montantEscompte(bon, sousTotal);
}
