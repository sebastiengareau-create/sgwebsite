# Clients

Un seul code, sur la branche **`main`** — le modèle de base, neutre. Chaque
client est une **installation séparée** (son projet Railway, sa base de
données, ses secrets) qui roule ce même code, avec son **profil** choisi par
la variable Railway `NEXT_PUBLIC_CLIENT`.

| Client | `NEXT_PUBLIC_CLIENT` | Branche déployée | Fiche |
|---|---|---|---|
| Modèle de base (démo, nouvelles ventes) | *(vide)* ou `template` | `client/template` | — |
| VR Premium | `vr-premium` | `client/vr-premium` | [vr-premium/CLIENT.md](vr-premium/CLIENT.md) |

## Appliquer une modification à un client

Fusionner dans `main` **n'applique rien aux clients**. Chaque projet Railway
déploie sa propre branche `client/<id>`, qui suit `main` avec du retard :
on décide quand et à qui une modification s'applique.

- **Voir ce qui attend** pour un client : comparer sa branche à `main` sur
  GitHub — `…/compare/client/vr-premium...main`.
- **Appliquer** : GitHub → Actions → « Appliquer aux clients » → Run
  workflow, avec le ou les clients (`vr-premium`, `template`, `tous`). Ou
  demander à Claude : « applique à VR Premium ».
- **Version** : vide = tout ce qui est dans `main`. Pour n'appliquer que
  jusqu'à une modification précise, donner son numéro de commit — les
  modifications s'appliquent dans l'ordre, on ne peut pas en sauter une.
- **Revenir en arrière** sur un client : bouton *Redeploy* d'un déploiement
  précédent dans Railway. La branche `client/<id>` ne recule jamais.
- Les migrations de base de données s'appliquent au client quand sa branche
  avance (au démarrage de son déploiement).

## Où vit ce qui distingue un client

- **Comportement** (type de véhicules, règles…) : son profil dans
  `lib/client.js`. Le code lit le profil ; il n'y a jamais de copie du code
  propre à un client.
- **Logos et icônes** : `public/clients/<id>/` (listés dans `images` du
  profil). Les images absentes viennent de `public/`. `logo-sombre.png`
  (facultatif) : logo transparent pour le thème sombre ; `logo.png` sert
  au thème clair et aux documents.
- **Nom, adresse, téléphone…** : dans l'appli (Administrateur →
  Informations de l'entreprise), donc dans la base du client.
- **Modules** (Administrateur → Modules) : sections entières activées ou non
  dans l'appli de chaque installation, sans changer le profil — ex. Paie
  (paie de démonstration à charger ou retirer dans Administrateur : employés
  fictifs, heures, lots comptabilisés et un lot en brouillon, `lib/paieDemo.js` ;
  fin d'année dans Paie → T4 et RL-1 (`/gerant/paie/fin-annee`) : déclaration T4
  en XML pour le Transfert de fichiers par Internet de l'ARC, validée selon le
  schéma 1-27-1 (`lib/finAnnee.js`), copies T4 des employés en PDF
  (`lib/pdfT4.js`) ; le RL-1 XML attend la certification de kontrolshop par
  Revenu Québec (`lib/rl1.js`) — d'ici là, sommaire à recopier dans Mon
  dossier ; relevés d'emploi préparés à partir des paies, fichier .BLK pour
  RE Web (`lib/releveEmploi.js`, `/gerant/paie/releves-emploi`) et copie de
  travail en PDF pour les dossiers (`lib/pdfReleveEmploi.js`)),
  Jobs en déplacement, **Productivité par employés** (rapport de
  productivité et rentabilité par employé, actif par défaut,
  `lib/productivite.js`), **Élevage** (troupeau de bœuf wagyu, découpe et vente
  de viande, registre de soins avec délai de retrait, saillies, vêlages et lignée
  avec alerte de consanguinité, courbe de poids et gain visé, date d'abattage prévue selon le poids visé, boucle ATQ validée, déplacements et
  registre à déclarer à Agri-Traçabilité Québec (`lib/registreElevage.js`),
  étiquettes à code QR
  des paquets et page publique de traçabilité `/tracabilite/<lot>`,
  `lib/elevage.js` ; troupeau de démonstration à charger ou retirer dans
  Administrateur, `lib/elevageDemo.js`), qui cohabite avec l'Inventaire ou le remplace
  (décocher « Inventaire » dans Rôles et accès).
  **Pointage de quart et feuilles de temps** (inactif par défaut,
  `lib/quarts.js`) : l'employé pointe arrivée, dîner, pause et départ à
  l'horodateur — le temps de présence, distinct du temps par tâche ; feuilles
  de temps par période (`/gerant/feuilles-temps`, accès « Employés ») avec
  heures supplémentaires à la semaine, efficacité (présence comparée au temps
  sur les bons), anomalies, corrections consignées, verrouillage et export
  CSV / Excel. Actif, la paie et la productivité prennent les heures de
  présence au lieu de l'horaire d'ouverture. Pointage de démonstration à
  charger ou retirer dans Administrateur (employés fictifs, période
  verrouillée, anomalies à régler, `lib/quartsDemo.js`).
  **Copropriété** (syndicat de copropriété : bâtiments (année et
  entrepreneur), unités et quotes-parts, copropriétaires et historique des
  propriétaires, contact d'urgence, clés magnétiques, mobilité réduite
  (aide pour évacuer, ♿ sur l'unité) et autres personnes sous leur toit —
  jamais sur le portail, charges communes,
  demandes de réparation et bons de travail, entretien préventif, documents
  et portail sécurisé des copropriétaires, `lib/copropriete.js` ; copropriété
  de démonstration à charger ou retirer dans Administrateur,
  `lib/coproprieteDemo.js`).
  **Immobilier** (inactif par défaut : propriétaire d'un ou de plusieurs
  immeubles locatifs — immeubles (année, entrepreneur ; plan par étage, une
  case par logement colorée selon son état : loyer en retard, vacant, bail à
  surveiller, en règle) et logements, locataires et baux avec les
  délais d'avis de modification du TAL et le renouvellement, loyers du mois,
  paiements et retards (un loyer inscrit est « à recevoir » jusqu'à son
  échéance, en retard dès le lendemain, signalé passé trois semaines — seuil
  de résiliation au TAL ; `etatCompte`, `lib/immobilierCalculs.js`, vérifié
  par `npm run test:immobilier`), tableau de bord avec la liste « À faire »
  et les loyers facturés et reçus des 12 derniers mois, **calcul des hausses
  de loyer** selon la méthode du TAL en vigueur depuis 2026 (par immeuble,
  `/immobilier/immeubles/<id>/hausses`, `lib/immobilierHausses.js` :
  pourcentage de base, part de la hausse des taxes et des assurances au-delà
  de ce pourcentage, 5 % des travaux majeurs ; nouveau loyer inscrit aux baux
  choisis et détail du calcul en PDF dans leurs documents — le pourcentage
  publié chaque janvier par le TAL s'ajoute à `POURCENTAGES_BASE_TAL`,
  `lib/immobilierCalculs.js`, ou s'inscrit dans l'appli en attendant),
  dépenses et rendement par immeuble, **revenus de location pour l'impôt**
  (`/immobilier/depenses/impot`, `lib/immobilierImpot.js` : état annuel de
  chaque immeuble sur les lignes du T776 — mêmes renseignements au TP-128 —,
  PDF pour le comptable et détail en CSV ; les travaux majeurs, cochés
  « dépense d'immobilisation » sur la réparation ou en catégorie de dépense
  « Travaux majeurs », sont listés à part pour l'amortissement et préchoisis
  dans le calcul des hausses), **état des lieux numérique** d'entrée et de
  sortie depuis la fiche du bail (`/immobilier/etats-lieux/<id>`,
  `lib/etatsLieux.js`, `lib/etatsLieuxCalculs.js` : rempli au téléphone pièce
  par pièce — grille selon le nombre de pièces —, état de chaque élément,
  remarque et photos, compteurs et clés ; la sortie reprend la grille de
  l'entrée du même bail et signale ce qui s'est dégradé ; terminé, un PDF
  avec photos en annexe, à faire signer en ligne par le locateur et les
  locataires, verrouillé dès qu'une signature est demandée), **entretien
  préventif** des immeubles (`/immobilier/entretien`, `lib/entretienImmo.js` :
  calendrier par immeuble — ramonage, avertisseurs de fumée, chauffe-eau,
  gouttières… proposés, les essentiels ajoutés d'un coup —, « Fait » inscrit
  l'intervention comme réparation terminée avec son coût et avance la
  prochaine date ; avis d'accès de 24 h préparés pour tous les baux de
  l'immeuble quand l'entretien se fait dans les logements ; en retard ou dans
  14 jours : dans « À faire » et les avis au propriétaire), réparations avec
  photos, documents avec date d'expiration, bail de logement en aide-mémoire
  (sections A à H du formulaire du TAL, mentions saisies dans la fiche du
  bail — pas le formulaire obligatoire), avis,
  rappels, état des lieux et reçus générés en PDF (`lib/pdfImmobilier.js`),
  **bail officiel du TAL** dans la fiche du bail (`lib/bailTal.js` : le bail
  se remplit et se signe sur la plateforme du TAL — formulaire obligatoire,
  toujours à jour, acheté par le propriétaire — ; fiche des données du bail
  dans l'ordre des sections A à H, un bouton « Copier » par case, loyer le
  plus bas des 12 mois précédents calculé pour la section G ; le PDF signé
  se dépose ensuite dans les documents du bail, catégorie `BAIL_TAL`,
  visible au locataire, ou se fait signer en ligne ici s'il ne l'est pas ;
  une reconduction ne demande pas de nouveau formulaire ; nouveau bail sans
  bail officiel déposé : dans « À faire » jusqu'à 90 jours après son début,
  la plateforme ne le gardant que 90 jours ; le bail généré par l'appli
  devient un aide-mémoire),
  **signature électronique** du bail, de la réponse à l'avis de modification
  et de tout PDF déposé : lien personnel par courriel (`/signature/<jeton>`),
  signature au doigt avec consentement, IP et empreinte SHA-256, version
  signée et certificat de signature envoyés aux locataires
  (`lib/signatureImmo.js`), préparation et suivi des
  relevés 31 (`/immobilier/releve-31`), portail sécurisé des locataires
  (`/portail-locataire/<jeton>` : bail, compte et reçus, documents partagés,
  demandes de réparation, réponse signée à l'avis de modification, documents
  à signer), envoi par
  courriel des avis, relevés de compte et reçus avec journal des envois
  (`lib/immobilierCourriel.js`, exige l'envoi de courriel configuré),
  **automatisations** (`/immobilier/automatisations`, `lib/immobilierAuto.js`,
  une vérification par jour de 8 h à 18 h, chacune à activer) : loyers
  inscrits tout seuls le 1er du mois, rappel par courriel aux locataires en
  retard N jours après l'échéance (un par loyer impayé, consigné au bail), et
  avis au propriétaire dans la cloche (avis de modification à envoyer, avis
  sans réponse ou refusé, bail à renouveler ou échu, retard de plus de trois
  semaines, assurance qui expire — type `IMMO_A_SURVEILLER`, actif par
  défaut), `lib/immobilier.js` ;
  volontairement relié ni à la comptabilité ni aux fournisseurs ni aux autres
  modules — à brancher client par client ; parc de démonstration à charger ou
  retirer dans Administrateur, `lib/immobilierDemo.js`).
  **Inspection numérique** (active par défaut, `lib/inspections.js`) :
  inspection multipoint lancée depuis le bon, avec une grille complète, rapide
  ou VR selon le type de véhicules du profil (`lib/grillesInspection.js`),
  que chaque garage peut modifier dans Paramètres → Grilles d'inspection
  (gardées dans sa base, réglage `grilles_inspection`), avec les seuils qui
  proposent l'état d'un point selon sa mesure — plaquettes en mm, pneus en
  /32 po, batterie en V (réglage `seuils_inspection`). Le
  technicien note chaque point (OK, à surveiller, urgent, sans objet) avec
  mesure, constat, photos et travail recommandé ; le comptoir met les prix et
  envoie le rapport par courriel ou texto (`/inspection/<jeton>`), où le
  client voit les photos, coche les travaux, signe et approuve ; les travaux
  approuvés s'ajoutent ensuite au bon en tâches. À la visite suivante du
  véhicule, la carte du bon montre les points restés à surveiller (à ajouter
  au bon ou à écarter), la nouvelle inspection montre ce qui avait été noté
  point par point, et le rappel d'entretien par courriel les mentionne
  (`lib/rappelsInspection.js`).
  **Entreposage de pneus** (inactif par défaut, `lib/pneus.js`) : les jeux de
  pneus des clients gardés à l'atelier (`/pneus`, accès « Entreposage de
  pneus », offert par défaut à la secrétaire et au mécanicien) — numéro
  PN-001, saison, dimension, jantes, emplacement ; **pneu par pneu** (avant
  gauche, avant droit… : usure en /32 po, code DOT et âge, pneu endommagé
  avec remarque) d'où l'**état du jeu** — bon, à surveiller, à remplacer selon
  le pneu le plus usé et le plus vieux (seuils réglables, `pneus_seuils`) — et
  les conseils de pose (permutation, alignement à vérifier) ; **roues et
  équipement** (clé antivol, capteurs de pression, enjoliveurs, couple de
  serrage, pression) rappelés à la pose ; photos à l'entrée ; **reçu
  d'entreposage** en PDF à faire signer ou envoyé par courriel
  (`lib/pdfRecuPneus.js`, conditions réglables `pneus_conditions`) ;
  historique des entrées, sorties, déplacements et remises ; étiquettes à code
  QR qui ouvrent la fiche du jeu. **Plan de l'entrepôt** (rangées et nombre de
  places, `pneus_entrepot` : places A-01, A-02…) : grille colorée par saison,
  places libres proposées dans les formulaires, place déjà prise refusée.
  Tableau de bord : avancement du changement de saison, jeux à remplacer
  (pneus neufs à proposer, texto prérempli), jeux oubliés (plus d'un an à
  l'entrepôt), liste en CSV. Sur le bon, « Changement de saison » pose le jeu
  entreposé et entrepose celui qui sort du véhicule à l'emplacement libéré,
  avec la tâche (clé antivol et serrage à revérifier) et le prix de
  l'entreposage (réglage `pneus_prix_saison`, poste 4040) ajoutés au bon.
  Rappels de changement de saison (pneus d'hiver avant le 1er décembre, d'été
  au printemps) par courriel ou texto, qui signalent un jeu à remplacer ; le
  portail client le signale aussi. Calculs vérifiés par `npm run test:pneus`.
  Jeux de démonstration (et un plan, s'il n'y en a pas) avec l'atelier de
  démonstration.
  **Paiement en ligne (Stripe)** (inactif par défaut, `lib/paiementEnLigne.js`,
  exige `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` — voir
  GUIDE-NOUVEAU-CLIENT.md) : le client paie le solde de sa facture par carte
  sur sa page `/payer/<jeton>` (lien dans le courriel de la facture, ou par
  texto depuis la facture du bon), ou verse un dépôt après avoir approuvé en
  ligne sa soumission ou les travaux de son inspection (pourcentage réglé dans
  Paramètres → Paiement en ligne). Stripe confirme par un avis signé
  (`/api/stripe/webhook`) : le paiement s'inscrit tout seul sur la facture ou
  en dépôt (compte de trésorerie « Paiements en ligne (Stripe) », GL 1020),
  frais de Stripe en frais bancaires ; un paiement qui ne peut pas s'inscrire
  tout seul reste « à traiter » dans Paramètres.
  **Textos automatiques (Twilio)** (inactif par défaut, option payante,
  `lib/textosAuto.js`, exige `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` et
  `TWILIO_NUMERO` — voir GUIDE-NOUVEAU-CLIENT.md) : chaque envoi s'active à
  part dans Paramètres → Textos automatiques — les boutons « 💬 Texto »
  envoient du numéro de l'atelier sans ouvrir Messages, texto « véhicule
  prêt » à la facturation du bon (avec le lien de paiement en ligne s'il
  reste un solde), rappel la veille du rendez-vous à l'heure choisie, et
  réponses des clients dans la page Textos (`/textos`, accès « Clients »,
  conversations par numéro, avis à l'atelier). Un client qui répond ARRET
  (ou STOP) ne reçoit plus rien jusqu'à RETOUR (ou START). Réponses de
  Twilio signées (`/api/twilio/entrant`, `/api/twilio/statut`). Sans le
  module, le texto prérempli part du téléphone, gratuit (`lib/textos.js`).
  **Portail client** (actif par défaut, `lib/portailClient.js`) : un lien
  secret par client (`/portail-client/<jeton>`), créé et envoyé (courriel ou
  texto) depuis sa fiche, révocable ; le client y voit son solde à payer
  (paiement en ligne si actif), ses travaux en cours, les soumissions et
  rapports d'inspection qui attendent sa réponse, ses rendez-vous, ses
  véhicules (points à surveiller, pneus entreposés), ses factures en PDF, et
  choisit s'il reçoit les promotions par courriel. Le lien est aussi ajouté
  au courriel de la facture. Chaque client de l'atelier de démonstration a
  son lien (« Voir comme le client »).
  **Double vérification à la connexion** (inactive par défaut : gérants et
  niveau 4 reçoivent un code par courriel après leur mot de passe,
  `lib/protectionConnexion.js` — exige l'envoi de courriel configuré).
- **Atelier de démonstration** (Administrateur → Atelier de démonstration,
  `lib/atelierDemo.js`) : clients, véhicules, inventaire, fournisseurs, deux
  mécaniciens, bons à chaque étape, dix semaines de factures, soumissions,
  rendez-vous et inspections numériques (approuvée, envoyée avec un lien à
  essayer, en cours, et des points à revoir au rendez-vous de demain), des
  pneus entreposés (visibles avec le module Entreposage de pneus), à
  charger dans un atelier sans bon de travail puis à retirer
  d'un coup — pour présenter le modèle de base ou l'essayer. Offert seulement
  au modèle de base (réglage `atelierDemo` du profil, absent chez les
  clients). Les vrais dossiers ne sont pas touchés.
- **Écran de connexion de démonstration** (réglage `ecranDemo` du profil,
  modèle de base seulement) : « DÉMO » dans le haut et, sous le logo Garage,
  les autres déclinaisons (Ferme, Copropriété, Immobilier, Premium) en texte
  de leur couleur (`DECLINAISONS_DEMO`, `lib/marque.js`).
- **Marque du logiciel** (kontrolshop, slogan « Tout est sous kontrol. ») :
  `lib/marque.js` et `app/components/LogoKontrolshop.js`, pareille pour
  tous — discrète (bas de la page de connexion, Paramètres → À propos, avec
  un lien vers www.kontrolshop.com, `SITE_WEB`),
  jamais sur les documents du client. Le badge (GARAGE, FERME, COPROPRIÉTÉ,
  IMMOBILIER, BOUTIQUE, PREMIUM) et la couleur de l'aiguille suivent `secteurMarque`
  dans le profil. Logos en fichiers pour les pages d'accueil :
  `public/marque/`. Site de vente www.kontrolshop.com : dépôt à part
  `kontrolshop.com` (page statique publiée chez WHC par GitHub Actions).
- **Contexte** : `clients/<id>/CLIENT.md` — qui est le client, ce qui le
  distingue et pourquoi.

## Règles pour Claude

- Quand on dit travailler « pour » un client, lis sa fiche `CLIENT.md`.
- Une amélioration générale se code pour tous. Un besoin propre à un client
  devient un **réglage de profil** (valeur par défaut = comportement du
  modèle de base), jamais un `if (client === "…")` dispersé dans le code, ni
  une branche à part.
- Les branches `client/<id>` ne reçoivent **jamais de commit direct** : on
  les avance seulement jusqu'à une version de `main` (avance rapide, jamais
  de force), et seulement quand l'utilisateur demande d'appliquer à ce
  client. Le travail se fait toujours vers `main`.
- Nouveau client : l'ajouter au tableau ci-dessus et à `TOUS` dans
  `.github/workflows/appliquer-aux-clients.yml`, créer sa branche
  `client/<id>` depuis `main`, et régler son projet Railway sur elle.
- Chaque nouveau réglage : l'ajouter à `TEMPLATE` dans `lib/client.js` avec
  un commentaire, l'activer dans le profil du client, et le noter dans sa
  fiche.
- Les migrations Prisma sont communes à tous : elles s'appliquent à chaque
  client quand sa branche avance. Une migration doit donc rester compatible
  avec les clients encore en retard (ajouter plutôt que renommer ou
  supprimer).
