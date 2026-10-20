# Client : VR Premium

Garage d'entretien et de réparation de **véhicules récréatifs** (motorisés
et roulottes). Profil `vr-premium` dans `lib/client.js` ; sur Railway,
`NEXT_PUBLIC_CLIENT=vr-premium`, et son projet déploie la branche
`client/vr-premium` (voir « Appliquer une modification à un client » dans
`clients/README.md`).

## Ce que son profil change

- `typeVehicules: "vr"` — **catalogue de VR** (`lib/catalogueVr.js`,
  `lib/catalogueVehiculesVr.json`) au lieu du catalogue automobile :
  année → marque de VR → modèle → type (Classe A, B, C, roulotte, trailer,
  sellette…). Les modèles ne sont pas filtrés par année. La 4e liste
  s'appelle « Type / version », et Assistant SG parle de VR.
- `vehiculeObligatoire: true` — chaque bon porte sur un véhicule (pas
  d'option « Non précisé », premier véhicule du client présélectionné). Un
  nouveau véhicule peut être incomplet : une seule information suffit
  (marque, année, NIV, plaque…), le reste se complète plus tard (bouton
  « Modifier » du nouveau bon, ou fiche du client).
- `margePrixVente: 40` — à la création d'une pièce d'inventaire, le
  prix de vente est proposé pour une **marge de 40 %** sur la vente :
  coûtant ÷ 0,60 (ex. 10,00 $ → 16,67 $).
  Le champ reste modifiable ; une fois modifié à la main, le coûtant ne
  l'écrase plus.
- `vehiculesAVendre: true` — section **Véhicules à vendre** dans
  l'Inventaire (`/secretaire/inventaire/vehicules`, `lib/vehiculesAVendre.js`)
  pour les VR qui appartiennent au garage : fiche (VAV-001) avec coûtant
  d'achat et prix demandé.
  - Les **bons reliés** au VR (bouton sur sa fiche) sont des bons normaux au
    nom du client interne « Véhicules à vendre (interne) ». Leur facture est
    **sans taxes** et **payée d'office en augmentant le coûtant du VR** : la
    facture tombe à zéro, le profit prévu sur la vente du VR baisse d'autant.
  - La **vente** émet une facture de vente à part (VTE-001, avec TPS/TVQ) au
    client acheteur ; le coûtant (achat + bons) y est figé pour le profit
    réel, et le dossier du VR passe au client. Tous les bons doivent être
    facturés avant. Le gérant peut annuler la vente (le VR revient en stock).
  - Comptabilité : actif 1250 « Véhicules à vendre », revenu 4500 « Vente de
    véhicules », coût 5010 « Coût des véhicules vendus ». L'achat d'un VR se
    saisit dans les comptes à payer sur le poste « Achat de véhicule à vendre
    (actif) » (débite 1250).
- `partstech: false` — **pas de PartsTech** (agrégateur de pièces
  automobiles, propre au modèle de base) : ni bouton « Chercher dans
  PartsTech » dans les commandes, ni section Paramètres → PartsTech.
- `actionRapideInventaire: true` — dans la Vue d'ensemble du gérant, les
  **actions rapides** offrent « Inventaire » au lieu de « Employé / Paie »
  (la paie reste accessible par le menu).
- `rechercheFournisseursInventaire: true` — sur la page **Inventaire**, un
  bouton « 🔎 Rechercher chez nos fournisseurs » sous « Scanner une pièce »
  ouvre la recherche sur les sites des fournisseurs (ceux de Paramètres →
  « Rechercher des pièces ») sans passer par une commande en brouillon. On n'y
  colle pas de résultat : pour l'ajouter, passer par une commande.
- `photosArrivee: true` — à la création d'un bon, **5 photos du véhicule à
  l'arrivée** (Coin 1 à 4, Dash), compressées fort (800 px, JPEG 0,5) pour
  prendre le moins d'espace possible. Gardées en haut du bon, repliées et
  cliquables sur demande ; jamais imprimées. Facultatives.
- `piecesEnHautDuBon: true` — sur le bon, une seule section **« Pièces du
  bon »** en haut des tâches (plusieurs pièces possibles) au lieu d'une
  section par tâche. Les pièces ajoutées sont rattachées à la première tâche
  du bon ; sur la facture (page imprimée et PDF), elles sont dans une
  section « Pièces » à part, après les tâches.
- `materielAtelierParHeure: 1.5` — au bas de la facture, une ligne (le montant seul, sans les heures ni le taux)
  **« Fournitures d'atelier »** : heures de main-d'œuvre facturées × 1,50 $.
  Taxable, ajoutée au sous-total avant l'escompte, figée sur la facture
  (`totalMaterielAtelier`) et créditée au compte 4060 Autres revenus ; dans
  le rapport des ventes, comptée avec les autres revenus.
- `photosTachesCreation: true` — à la création d'un bon, un bouton 📷 sur
  chaque ligne de problème (plusieurs photos possibles, compressées comme
  les photos à l'arrivée) ; elles deviennent les photos de la tâche, comme
  celles prises ensuite sur le bon ou dans l'horodateur.
- `rechercheSousVehicule: false` — pas de bouton « 🔎 Rechercher des
  pièces » sous le véhicule du bon ; la recherche reste dans « Pièces du
  bon » (bouton 🔎).
- `photosTachesImprimees: false` — les photos des tâches **ne sont pas
  imprimées** sur le bon ni sur la facture ; elles restent sur le bon à
  l'écran (et ne sont jamais dans le PDF de la facture).
- `envoiPhotosCourriel: true` — dans la section facture du bon, un bouton
  **« 📷 Envoyer les photos »** à côté de « 🚗 Aviser le client » (moitié-
  moitié) envoie par courriel au client les photos des tâches, en pièces
  jointes (`POST /api/bons/[id]/envoyer-photos`). Courriel du dossier
  proposé, modifiable.
- `avertirBonNonFacture: true` — créer un bon pour un client qui a déjà un
  bon non facturé (en attente, planifié ou en cours) affiche un
  avertissement avec les numéros des bons : « Créer quand même un nouveau
  bon ? ». Vérifié par le serveur pour chaque façon de créer un bon :
  nouveau bon (dès le choix du client, puis à la création), rendez-vous du
  calendrier transformé en bon, soumission acceptée (`lib/bonsNonFactures.js`,
  `trouverBonsNonFactures` dans `lib/bons.js`). Cherche aussi dans les
  **dossiers semblables** (même nom, téléphone ou courriel) : un rendez-vous
  transformé en bon sans client du dossier crée un nouveau dossier, et le bon
  y reste — le message dit alors « au dossier C-… ». Au nouveau bon,
  continuer garde un rappel ⚠️ avec lien vers ces bons.
- `images` — logo et icônes dans `public/clients/vr-premium/`.

## Historique

- Jusqu'en septembre 2026, VR Premium avait sa propre branche
  `client-vr-premium`. Ses différences sont devenues ce profil ; elle roule
  maintenant `main`.
- Sa base a été créée avant les migrations versionnées : elle a en plus la
  migration `0_init_vr_premium` (table `Vehicule` d'origine), et sa version
  de `20260926120000_dossier_vehicule` convertissait cette table au lieu de
  la créer. Ces deux migrations sont déjà appliquées sur sa base, et
  `prisma migrate deploy` ne revient jamais dessus : le schéma est
  identique à celui de `main`, rien de spécial à faire.
