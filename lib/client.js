// ============================================================
// PROFIL DU CLIENT — un seul code (branche main) pour tous les garages
// ============================================================
// Chaque installation (projet Railway) choisit son profil avec la variable
// NEXT_PUBLIC_CLIENT (ex. « vr-premium »). Sans variable, c'est le modèle de
// base (« template »), neutre. Tout ce qui distingue un client du modèle se
// règle ici, jamais par du code à part — voir clients/README.md.
//
// Préfixe NEXT_PUBLIC_ : la valeur est aussi connue des composants du
// navigateur (elle est intégrée au build, que Railway refait à chaque
// changement de variable). Rien de secret ici.
//
// Le nom, l'adresse, etc. de l'entreprise restent dans lib/config.js
// (modifiables dans l'appli) ; ce profil ne couvre que ce qui change le
// comportement du logiciel.
// ============================================================

const TEMPLATE = {
  id: "template",
  // « auto » : catalogue automobile NHTSA ; « vr » : catalogue de véhicules
  // récréatifs (lib/catalogueVr.js)
  typeVehicules: "auto",
  // Chaque bon doit porter sur un véhicule (au moins marque et modèle)
  vehiculeObligatoire: false,
  // Majoration (%) appliquée au prix coûtant pour proposer le prix de vente
  // à la création d'une pièce d'inventaire (modifiable). null : aucune
  // proposition, le prix de vente se saisit seul.
  majorationPrixVente: null,
  // Images propres au client, dans public/clients/<id>/ ; les autres
  // viennent de public/ (celles du modèle de base)
  images: [],
};

const PROFILS = {
  template: TEMPLATE,
  "vr-premium": {
    ...TEMPLATE,
    id: "vr-premium",
    typeVehicules: "vr",
    vehiculeObligatoire: true,
    majorationPrixVente: 40,
    images: ["logo.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
  },
};

const idClient = process.env.NEXT_PUBLIC_CLIENT || "template";
if (!PROFILS[idClient]) {
  throw new Error(`NEXT_PUBLIC_CLIENT="${idClient}" : profil inconnu. Profils offerts : ${Object.keys(PROFILS).join(", ")} (voir lib/client.js).`);
}

export const CLIENT = PROFILS[idClient];
export const estVr = CLIENT.typeVehicules === "vr";

// Chemin public d'une image (« logo.png » → « /clients/vr-premium/logo.png »
// si le client a la sienne, sinon « /logo.png »)
export function image(nom) {
  return CLIENT.images.includes(nom) ? `/clients/${CLIENT.id}/${nom}` : `/${nom}`;
}

// Libellé de la 4e liste du dossier véhicule
export const LIBELLE_VERSION = estVr ? "Type / version" : "Version";
