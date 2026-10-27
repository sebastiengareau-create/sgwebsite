// Numéro d'assurance sociale (NAS) des employés, pour les feuillets T4 et
// RL-1. Gardé en 9 chiffres sans espaces ; affiché « 123 456 782 ».
// Aucune dépendance serveur : sert aussi au formulaire de la fiche.

// Garde les chiffres seulement
function normaliserNas(valeur) {
  return String(valeur || "").replace(/\D/g, "");
}

// 9 chiffres et clé de contrôle valide (algorithme de Luhn, comme l'ARC)
function nasValide(valeur) {
  const nas = normaliserNas(valeur);
  if (!/^\d{9}$/.test(nas)) return false;
  let somme = 0;
  for (let i = 0; i < 9; i++) {
    let chiffre = Number(nas[i]);
    if (i % 2 === 1) {
      chiffre *= 2;
      if (chiffre > 9) chiffre -= 9;
    }
    somme += chiffre;
  }
  return somme % 10 === 0;
}

function formaterNas(valeur) {
  const nas = normaliserNas(valeur);
  return nas.length === 9 ? `${nas.slice(0, 3)} ${nas.slice(3, 6)} ${nas.slice(6)}` : nas;
}

// « *** *** 782 » — pour l'affichage courant de la fiche
function masquerNas(valeur) {
  const nas = normaliserNas(valeur);
  return nas.length === 9 ? `*** *** ${nas.slice(6)}` : "";
}

module.exports = { normaliserNas, nasValide, formaterNas, masquerNas };
