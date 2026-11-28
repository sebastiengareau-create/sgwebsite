// Photo d'un immeuble (Immobilier) ou d'un bâtiment (Copropriété) — modèle
// PhotoBatiment, une au plus — et vue de la rue de Google Street View quand
// il n'y en a pas. Client et serveur ; les routes sont dans
// lib/photoBatimentServeur.js, l'affichage dans app/components/PhotoBatiment.js.

// Compression avant l'envoi : assez grande pour une bannière, assez légère
// pour la base (environ 150 à 300 Ko)
export const LARGEUR_PHOTO_BATIMENT = 1600;
export const QUALITE_PHOTO_BATIMENT = 0.7;

// « 123 rue Principale, Saint-Jérôme, QC, J7Z 1A1 »
export const adresseComplete = (x) => [x?.adresse, x?.ville, x?.province, x?.codePostal].map((v) => String(v || "").trim()).filter(Boolean).join(", ");

// Recherche de l'adresse dans Google Maps (aucune clé requise)
export const lienGoogleMaps = (adresse) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;

// Courte signature de l'adresse : la vue de la rue (gardée par le navigateur)
// se recharge quand l'adresse change
export function versionAdresse(adresse) {
  let h = 5381;
  for (const c of String(adresse || "")) h = ((h * 33) ^ c.codePointAt(0)) >>> 0;
  return h.toString(36);
}

// Adresse de l'image : la photo (v : sa date, pour recharger après un
// remplacement) ou la vue de la rue
export const urlPhoto = (urlApi, photoLe) => `${urlApi}?v=${encodeURIComponent(photoLe)}`;
export const urlVueRue = (urlApi, adresse) => `${urlApi}?vue=rue&a=${versionAdresse(adresse)}`;
