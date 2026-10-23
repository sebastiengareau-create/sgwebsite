// Escompte d'un bon : un pourcentage du sous-total avant taxes
// (BonTravail.escomptePourcent). Les bons d'avant le pourcentage gardent
// leur escompte en dollars (escompteMontant) tant qu'on ne le change pas.
// Le montant obtenu est figé sur la facture (Facture.escompteApplique).
// Client et serveur.

export function montantEscompte(bon, sousTotal) {
  if (bon.escomptePourcent > 0) {
    return Math.min(Math.round(sousTotal * bon.escomptePourcent) / 100, sousTotal);
  }
  return Math.min(bon.escompteMontant || 0, sousTotal); // jamais négatif
}

// « Escompte (10 % — client fidèle) »
export function libelleEscompte(bon) {
  const details = [bon.escomptePourcent > 0 && `${String(bon.escomptePourcent).replace(".", ",")} %`, bon.escompteRaison].filter(Boolean);
  return `Escompte${details.length ? ` (${details.join(" — ")})` : ""}`;
}
