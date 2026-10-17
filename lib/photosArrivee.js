// Photos du véhicule à son arrivée (modèle PhotoArrivee) : prises à la
// création du bon, gardées en référence en haut du bon (cliquables), jamais
// imprimées. Client et serveur.
export const POSITIONS_ARRIVEE = [
  { cle: "COIN_1", libelle: "Coin 1", libelleCourt: "Coin 1" },
  { cle: "COIN_2", libelle: "Coin 2", libelleCourt: "Coin 2" },
  { cle: "COIN_3", libelle: "Coin 3", libelleCourt: "Coin 3" },
  { cle: "COIN_4", libelle: "Coin 4", libelleCourt: "Coin 4" },
  { cle: "TABLEAU_BORD", libelle: "Tableau de bord", libelleCourt: "Dash" },
];

export const estPositionArrivee = (cle) => POSITIONS_ARRIVEE.some((p) => p.cle === cle);

// Adresse de l'image (servie par l'API, pour ne pas charger les photos avec
// la page du bon) ; v force le rechargement après un remplacement
export const urlPhotoArrivee = (bonId, position, v = "") => `/api/bons/${bonId}/photos-arrivee/${position}${v ? `?v=${encodeURIComponent(v)}` : ""}`;
