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
  fictifs, heures, lots comptabilisés et un lot en brouillon, `lib/paieDemo.js`),
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
  **Copropriété** (syndicat de copropriété : unités et quotes-parts,
  copropriétaires et historique des propriétaires, charges communes,
  demandes de réparation et bons de travail, entretien préventif, documents
  et portail sécurisé des copropriétaires, `lib/copropriete.js` ; copropriété
  de démonstration à charger ou retirer dans Administrateur,
  `lib/coproprieteDemo.js`).
  **Immobilier** (inactif par défaut : propriétaire d'un ou de plusieurs
  immeubles locatifs — immeubles et logements, locataires et baux avec les
  délais d'avis de modification du TAL et le renouvellement, loyers du mois,
  paiements et retards, dépenses et rendement par immeuble, réparations avec
  photos, documents avec date d'expiration, bail de logement complet (sections
  A à H du formulaire du TAL, mentions saisies dans la fiche du bail), avis,
  rappels, état des lieux et reçus générés en PDF (`lib/pdfImmobilier.js`),
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
  `lib/immobilier.js` ;
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
  **Double vérification à la connexion** (inactive par défaut : gérants et
  niveau 4 reçoivent un code par courriel après leur mot de passe,
  `lib/protectionConnexion.js` — exige l'envoi de courriel configuré).
- **Atelier de démonstration** (Administrateur → Atelier de démonstration,
  `lib/atelierDemo.js`) : clients, véhicules, inventaire, fournisseurs, deux
  mécaniciens, bons à chaque étape, dix semaines de factures, soumissions,
  rendez-vous et inspections numériques (approuvée, envoyée avec un lien à
  essayer, en cours, et des points à revoir au rendez-vous de demain), à
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
