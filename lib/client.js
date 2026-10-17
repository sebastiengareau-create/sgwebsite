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
  // Chaque bon doit porter sur un véhicule : un du dossier du client, ou un
  // nouveau avec au moins une information (année, marque, NIV, plaque…) —
  // incomplet au besoin, à compléter plus tard
  vehiculeObligatoire: false,
  // Marge (%) sur le prix de vente, pour proposer ce prix à partir du
  // coûtant à la création d'une pièce d'inventaire (modifiable) :
  // vente = coûtant ÷ (1 − marge). null : aucune proposition, le prix de
  // vente se saisit seul.
  margePrixVente: null,
  // Section « Véhicules à vendre » dans l'inventaire : véhicules qui
  // appartiennent à l'entreprise (coûtant, prix demandé), bons internes
  // reliés — facturés sans taxes et payés en augmentant le coûtant du
  // véhicule — et facture de vente au client. Voir lib/vehiculesAVendre.js.
  vehiculesAVendre: false,
  // PartsTech (lib/partstech.js) : recherche de pièces depuis une commande
  // en brouillon et section Paramètres → PartsTech. false : retiré de
  // l'appli (bouton, paramètres et routes).
  partstech: true,
  // Vue d'ensemble du gérant, actions rapides : true remplace le bouton
  // « Employé / Paie » par « Inventaire »
  actionRapideInventaire: false,
  // Page Inventaire : bouton « 🔎 Rechercher chez nos fournisseurs » (sites
  // des fournisseurs, lib/recherchePieces.js) sous « Scanner une pièce »,
  // sans passer par une commande en brouillon
  rechercheFournisseursInventaire: false,
  // Photos du véhicule à l'arrivée (4 coins + tableau de bord) prises à la
  // création du bon et gardées en référence en haut du bon, jamais
  // imprimées (lib/photosArrivee.js)
  photosArrivee: false,
  // Bon de travail : une seule section « Pièces du bon » en haut des tâches
  // (plusieurs pièces, toutes celles du bon) au lieu d'une section par
  // tâche ; les pièces ajoutées sont rattachées à la première tâche
  piecesEnHautDuBon: false,
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
    margePrixVente: 40,
    vehiculesAVendre: true,
    partstech: false,
    actionRapideInventaire: true,
    rechercheFournisseursInventaire: true,
    photosArrivee: true,
    piecesEnHautDuBon: true,
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
