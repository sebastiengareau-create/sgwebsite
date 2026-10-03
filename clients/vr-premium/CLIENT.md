# Client : VR Premium

Garage d'entretien et de réparation de **véhicules récréatifs** (motorisés
et roulottes). Profil `vr-premium` dans `lib/client.js` ; sur Railway,
`NEXT_PUBLIC_CLIENT=vr-premium`.

## Ce que son profil change

- `typeVehicules: "vr"` — **catalogue de VR** (`lib/catalogueVr.js`,
  `lib/catalogueVehiculesVr.json`) au lieu du catalogue automobile :
  année → marque de VR → modèle → type (Classe A, B, C, roulotte,
  sellette…). Les modèles ne sont pas filtrés par année. La 4e liste
  s'appelle « Type / version », et Assistant SG parle de VR.
- `vehiculeObligatoire: true` — chaque bon porte sur un véhicule (marque et
  modèle exigés, pas d'option « Non précisé », premier véhicule du client
  présélectionné).
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
