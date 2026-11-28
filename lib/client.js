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
  // QuickBooks (lib/quickbooks.js) : section Paramètres → QuickBooks avec le
  // bouton « Connecter QuickBooks ». false : section retirée et connexion
  // refusée (routes /api/quickbooks/connect et callback).
  quickbooks: true,
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
  // Pièce d'inventaire : une photo de référence (facultative), à prendre
  // dans le formulaire « Nouvelle pièce » ou plus tard sur sa fiche, où on
  // la remplace et la consulte au besoin — ex. pour reconnaître la pièce sur
  // la tablette (lib/photoPiece.js)
  photoPiece: false,
  // Bon de travail : une seule section « Pièces du bon » en haut des tâches
  // (plusieurs pièces, toutes celles du bon) au lieu d'une section par
  // tâche ; les pièces ajoutées sont rattachées à la première tâche. Vaut
  // aussi pour les soumissions (section « Pièces » avant les tâches)
  piecesEnHautDuBon: false,
  // Facture : ligne « Fournitures d'atelier » au bas, heures de main-d'œuvre
  // facturées × ce montant ($/h), taxable (lib/materielAtelier.js). null :
  // pas de ligne.
  materielAtelierParHeure: null,
  // Nouveau bon : bouton 📷 sur chaque ligne de problème, pour montrer le
  // problème ; les photos rejoignent celles de la tâche une fois le bon créé
  photosTachesCreation: false,
  // Bon de travail : bouton « 🔎 Rechercher des pièces » sous le véhicule
  // (la recherche reste offerte dans la section des pièces)
  rechercheSousVehicule: true,
  // Photos des tâches sur le bon imprimé / la facture imprimée. false : les
  // photos restent sur le bon (à l'écran), jamais imprimées
  photosTachesImprimees: true,
  // Bon et facture du bon : bouton « 📷 Envoyer les photos » (sur le bon pas
  // encore facturé, au-dessus de « Émettre la facture » ; sur la facture, à
  // côté de « Aviser le client »), qui envoie par courriel les photos des
  // tâches en pièces jointes (POST /api/bons/[id]/envoyer-photos)
  envoiPhotosCourriel: false,
  // Nouveau bon : en choisissant un client qui a déjà un bon non facturé,
  // avertir (avec les numéros) et demander s'il faut continuer quand même
  avertirBonNonFacture: false,
  // Bon de travail : section « Note interne » entre les pièces et les tâches,
  // texte libre consulté à l'écran seulement (jamais imprimé ni facturé)
  noteInterneBon: false,
  // Horodateur : chaque bon actif est une carte compacte (3 premières
  // tâches, « … et N autres ») avec un bouton pour déployer toutes ses
  // tâches et leurs chronos ; mon chrono en cours reste visible, avec
  // « Arrêter »
  horodateurBonsReplies: true,
  // Bon de travail : une pièce s'ajoute même sans assez de stock (ou à 0) ;
  // l'inventaire tombe alors en négatif, à corriger à la réception. Vaut
  // aussi pour les pièces des kits. false : stock insuffisant refusé (ou
  // commande en B/O, pour qui peut commander).
  stockNegatifBons: false,
  // Soumissions : un seul bouton « Facturé » au lieu de « Accepter → créer
  // le bon ». La facture reprend exactement ce qui a été entré (heures
  // estimées × taux horaire, pièces estimées), plus les taxes — sans
  // fournitures d'atelier ni escompte (app/api/soumissions/[id]/facturer).
  soumissionFacturerDirect: false,
  // Soumission facturée directement (soumissionFacturerDirect) : son coût de
  // main-d'œuvre est fixé à heures estimées × « Coûtant horaire des
  // mécaniciens » (Paramètres) — il n'y a pas de poinçon sur ce bon. Il
  // compte dans la rentabilité de la facture (fiche du bon), pas dans le
  // grand livre (la paie y passe déjà les salaires). false : 0 $, comme
  // tout bon sans heures poinçonnées.
  soumissionCoutMainOeuvre: false,
  // Tableau de rentabilité (gérant) aussi sous le total estimé d'un bon pas
  // encore facturé (« Rentabilité bon ») et sous le total d'une soumission
  // (« Rentabilité soumission » : coûtant des pièces de l'inventaire +
  // heures estimées × coûtant horaire des mécaniciens). false : seulement
  // sous la facture, comme toujours.
  rentabiliteBonEtSoumission: false,
  // Factures (bon, vente de véhicule, PDF) : une ligne « Signature » pour
  // signer au bas, au lieu de la mention « document généré le … ». Vaut
  // aussi pour le bon de travail imprimé (app/bons/[id]/commande).
  // false : la mention « <entreprise> — document généré le … » au bas.
  signatureFacture: true,
  // Factures du bon (page imprimée et PDF) : le numéro de la pièce
  // d'inventaire devant son nom sur chaque ligne de pièce (activé aussi
  // dans le modèle de base depuis novembre 2026)
  numeroPieceFacture: true,
  // Administrateur → Atelier de démonstration (lib/atelierDemo.js) : clients,
  // bons, factures… d'essai à charger et à retirer. Offert seulement à
  // l'installation du modèle de base (profil « template » ci-dessous) ;
  // false : panneau absent et route refusée.
  atelierDemo: false,
  // Écran de connexion en mode démonstration : « DÉMO » dans le haut (chaque
  // déclinaison a sa propre démo, sans lien vers les autres). false : écran
  // de connexion habituel.
  ecranDemo: false,
  // Sections retirées de l'installation pour tout le monde, développeur
  // compris : absentes du menu et de Administrateur → Rôles et accès, pages
  // refusées (lib/auth.js, aAccesSection). Ex. les sections du garage chez
  // un propriétaire d'immeubles ou un syndicat de copropriété
  // (SECTIONS_GARAGE). [] : toutes offertes.
  sectionsRetirees: [],
  // Secteur affiché avec la marque kontrolshop (badge et couleur de
  // l'aiguille du logo, lib/marque.js) : « garage », « ferme »,
  // « copropriete », « immobilier », « boutique » ou « premium »
  secteurMarque: "garage",
  // Réglages écrits dans la base au démarrage du serveur, seulement s'ils
  // n'y sont pas encore (lib/reglagesDemarrage.js, appelé par
  // instrumentation.js) : { cle: valeur } de la table Parametre — modules
  // (« module_immobilier »: "actif"), sections d'un rôle
  // (« role_defaut_GERANT »)… Sert aux démos d'une déclinaison : elles
  // démarrent avec les bons modules, que l'Administrateur peut ensuite
  // changer comme d'habitude (jamais réécrits). {} : rien.
  reglagesDemarrage: {},
  // Page d'arrivée du gérant, du niveau 4 et du développeur après la
  // connexion (et à l'accueil « / »), ex. « /immobilier ». null : la vue
  // d'ensemble du garage (/gerant). Les autres rôles gardent leur page.
  accueilGerant: null,
  // Images propres au client, dans public/clients/<id>/ ; les autres
  // viennent de public/ (celles du modèle de base). « logo-sombre.png » :
  // version du logo pour le thème sombre (app/components/LogoClient.js)
  images: [],
};

// Déclinaison Premium : les réglages de VR Premium, repris tels quels par la
// démo Premium (« demo-premium ») — un réglage changé pour VR Premium change
// aussi la démo, qui montre ce que reçoit un client Premium.
const PREMIUM = {
  typeVehicules: "vr",
  vehiculeObligatoire: true,
  margePrixVente: 40,
  vehiculesAVendre: true,
  partstech: false,
  quickbooks: false,
  actionRapideInventaire: true,
  rechercheFournisseursInventaire: true,
  photosArrivee: true,
  photoPiece: true,
  piecesEnHautDuBon: true,
  materielAtelierParHeure: 1.5,
  photosTachesCreation: true,
  rechercheSousVehicule: false,
  photosTachesImprimees: false,
  envoiPhotosCourriel: true,
  avertirBonNonFacture: true,
  noteInterneBon: true,
  stockNegatifBons: true,
  soumissionFacturerDirect: true,
  soumissionCoutMainOeuvre: true,
  rentabiliteBonEtSoumission: true,
  signatureFacture: true,
  numeroPieceFacture: true,
  // Marque kontrolshop en déclinaison Premium : logo métal or dans
  // Paramètres → À propos, aiguille et badge or au bas de la connexion
  secteurMarque: "premium",
};

// Démos des déclinaisons (projet Railway du modèle de base, un service et une
// base par démo, tous sur la branche client/template — voir
// clients/README.md). Mêmes images que le modèle de base, sauf le logo :
// le logo métal de la déclinaison (public/marque/kontrolshop-metal-*.png).
const IMAGES_DEMO = ["logo.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
// Copropriété et Immobilier : les sections propres au garage retirées du
// menu du gérant et de la secrétaire au premier démarrage (Rôles et accès)
const SECTIONS_SANS_GARAGE = ["inventaire", "pneus", "horodateur", "jobs-temps-reel", "jobs-deplacement"];
function sectionsSansGarage(liste) {
  return liste.filter((s) => !SECTIONS_SANS_GARAGE.includes(s)).join(",");
}
const GERANT_SANS_GARAGE = sectionsSansGarage(["operations", "calendrier", "clients", "fournisseurs", "inventaire", "comptabilite", "paie", "employes", "documents", "vue-ensemble", "jobs-temps-reel", "jobs-deplacement", "horodateur", "parametres", "notifications", "elevage", "copropriete", "immobilier", "pneus"]);
const SECRETAIRE_SANS_GARAGE = sectionsSansGarage(["operations", "calendrier", "clients", "inventaire", "documents", "elevage", "copropriete", "immobilier", "pneus"]);
// Sections propres au garage, retirées des installations Ferme, Immobilier
// et Copropriété : bons et factures, clients, calendrier des rendez-vous,
// horodateur, inventaire, pneus, jobs, productivité et vue d'ensemble de
// l'atelier (le gérant arrive sur son module, accueilGerant)
const SECTIONS_GARAGE = ["operations", "calendrier", "clients", "inventaire", "pneus", "horodateur", "jobs-temps-reel", "jobs-deplacement", "vue-ensemble"];
// Modules du garage éteints au premier démarrage des démos sans atelier
const MODULES_GARAGE_INACTIFS = { module_inspection: "inactif", module_portail_client: "inactif", module_productivite: "inactif" };

const PROFILS = {
  // Modèle de base (démo) : logo kontrolshop Garage (métal et aiguille
  // orange, PNG transparent avec ombre douce, lisible sur fond clair comme
  // sombre). La grille des 4 secteurs (public/marque/) s'est avérée trop
  // petite à l'écran. Les autres clients sans logo à eux gardent
  // public/logo.png.
  // Icônes (onglet du navigateur, appli installée) : l'emblème K + aiguille
  // du logo, sur fond sombre.
  template: { ...TEMPLATE, atelierDemo: true, ecranDemo: true, images: ["logo.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"] },
  "vr-premium": {
    ...TEMPLATE,
    id: "vr-premium",
    ...PREMIUM,
    images: ["logo.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
  },

  // ---------- Démos des déclinaisons (vente) ----------
  // Premium : les réglages de VR Premium, avec l'atelier de démonstration
  "demo-premium": {
    ...TEMPLATE,
    id: "demo-premium",
    ...PREMIUM,
    atelierDemo: true,
    ecranDemo: true,
    images: IMAGES_DEMO,
  },
  // Ferme : module Élevage actif (troupeau de démonstration dans
  // Administrateur), sections du garage retirées — la viande se vend depuis
  // Élevage → Viande, avec son propre stock de paquets
  "demo-ferme": {
    ...TEMPLATE,
    id: "demo-ferme",
    ecranDemo: true,
    secteurMarque: "ferme",
    accueilGerant: "/elevage",
    sectionsRetirees: SECTIONS_GARAGE,
    reglagesDemarrage: {
      module_elevage: "actif",
      // Option du forfait montrée en démo : Élevage relié à la comptabilité
      module_elevage_comptabilite: "actif",
      ...MODULES_GARAGE_INACTIFS,
    },
    images: IMAGES_DEMO,
  },
  // Copropriété : module Copropriété actif (copropriété de démonstration
  // dans Administrateur), sections du garage retirées
  "demo-copropriete": {
    ...TEMPLATE,
    id: "demo-copropriete",
    ecranDemo: true,
    secteurMarque: "copropriete",
    accueilGerant: "/copropriete",
    sectionsRetirees: SECTIONS_GARAGE,
    reglagesDemarrage: {
      module_copropriete: "actif",
      // Option du forfait montrée en démo : Copropriété reliée à la comptabilité
      module_copropriete_comptabilite: "actif",
      ...MODULES_GARAGE_INACTIFS,
      role_defaut_GERANT: GERANT_SANS_GARAGE,
      role_defaut_SECRETAIRE: SECRETAIRE_SANS_GARAGE,
    },
    images: IMAGES_DEMO,
  },
  // Immobilier : module Immobilier actif (parc de démonstration dans
  // Administrateur), sections du garage retirées
  "demo-immobilier": {
    ...TEMPLATE,
    id: "demo-immobilier",
    ecranDemo: true,
    secteurMarque: "immobilier",
    accueilGerant: "/immobilier",
    sectionsRetirees: SECTIONS_GARAGE,
    reglagesDemarrage: {
      module_immobilier: "actif",
      // Option du forfait montrée en démo : Immobilier relié à la comptabilité
      module_immobilier_comptabilite: "actif",
      ...MODULES_GARAGE_INACTIFS,
      role_defaut_GERANT: GERANT_SANS_GARAGE,
      role_defaut_SECRETAIRE: SECRETAIRE_SANS_GARAGE,
    },
    images: IMAGES_DEMO,
  },
};

// Page d'arrivée d'un rôle après la connexion (accueilGerant du profil pour
// le gérant, le niveau 4 et le développeur)
export function accueilDuRole(role) {
  if (role === "DEVELOPPEUR" || role === "NIVEAU4" || role === "GERANT") return CLIENT.accueilGerant || "/gerant";
  return `/${String(role).toLowerCase()}`;
}

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
