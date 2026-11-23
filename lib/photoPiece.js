// Photo de référence d'une pièce d'inventaire (modèle PhotoPiece, réglage
// photoPiece du profil) : une au plus par pièce, prise ou remplacée depuis
// la fiche de la pièce et consultée au besoin — jamais imprimée. Client et
// serveur.

// Compression avant l'envoi : assez grande pour lire une étiquette ou un
// numéro sur la pièce, assez légère pour la base (environ 80 à 150 Ko).
export const LARGEUR_PHOTO_PIECE = 1024;
export const QUALITE_PHOTO_PIECE = 0.6;

// Adresse de l'image (servie par l'API, pour ne pas charger la photo avec la
// fiche) ; v force le rechargement après un remplacement
export const urlPhotoPiece = (pieceId, v = "") => `/api/inventaire/${pieceId}/photo${v ? `?v=${encodeURIComponent(v)}` : ""}`;
