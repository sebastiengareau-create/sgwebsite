// Services offerts sur le site de réservation (modèle ServiceWeb) — règles
// communes à la création et à la modification.
const DUREE_MIN = 15;
const DUREE_MAX = 600;
const LONGUEUR_MAX_NOM = 80;

// → { data: { nom?, dureeMinutes?, actif? } } ou { erreur }. partiel : seuls
// les champs reçus sont validés (modification).
function validerServiceWeb(corps, { partiel = false } = {}) {
  const data = {};
  if (!partiel || corps.nom !== undefined) {
    const nom = String(corps.nom || "").trim();
    if (!nom) return { erreur: "Indique le nom du service." };
    if (nom.length > LONGUEUR_MAX_NOM) return { erreur: `Nom trop long (${LONGUEUR_MAX_NOM} caractères maximum).` };
    data.nom = nom;
  }
  if (!partiel || corps.dureeMinutes !== undefined) {
    const duree = Number(corps.dureeMinutes);
    if (!Number.isInteger(duree) || duree < DUREE_MIN || duree > DUREE_MAX) {
      return { erreur: `Durée invalide (${DUREE_MIN} à ${DUREE_MAX} minutes).` };
    }
    data.dureeMinutes = duree;
  }
  if (corps.actif !== undefined) data.actif = corps.actif === true;
  return { data };
}

module.exports = { validerServiceWeb, DUREE_MIN, DUREE_MAX };
