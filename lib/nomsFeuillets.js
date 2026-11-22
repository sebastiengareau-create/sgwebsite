// Noms et codes des feuillets de fin d'année (T4, RL-1, relevé d'emploi),
// sans dépendance au serveur (utilisés aussi dans le navigateur).

// Nom complet « Marc-André Tremblay » → nom de famille « Tremblay » et
// prénom « Marc-André » : le dernier mot est le nom de famille. Sert
// seulement quand les champs prenom / nomFamille de la fiche sont vides.
// Une précision entre parenthèses à la fin (« (démo) », « (soir) ») est ignorée
const mots = (nom) => String(nom || "").replace(/\s*\([^)]*\)\s*$/, "").trim().split(/\s+/).filter(Boolean);
export const nomFamilleDe = (nom) => { const m = mots(nom); return m.length > 1 ? m[m.length - 1] : m[0] || ""; };
export const prenomDe = (nom) => { const m = mots(nom); return m.length > 1 ? m.slice(0, -1).join(" ") : ""; };

// Noms d'un employé pour les feuillets : ceux de la fiche, sinon tirés du nom
export function nomsEmploye(employe) {
  return {
    nomFamille: (employe.nomFamille || "").trim() || nomFamilleDe(employe.nom),
    prenom: (employe.prenom || "").trim() || prenomDe(employe.nom),
    deduits: !(employe.nomFamille || "").trim(),
  };
}

// T4, case 45 : accès à des soins dentaires offerts par l'employeur
export const CODES_DENTAIRES = {
  1: "Aucun accès à une assurance dentaire",
  2: "Employé seulement",
  3: "Employé, conjoint et enfants à charge",
  4: "Employé et conjoint",
  5: "Employé et enfants à charge",
};
