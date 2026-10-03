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
- `majorationPrixVente: 40` — à la création d'une pièce d'inventaire, le
  prix de vente est proposé à **coûtant + 40 %** (ex. 10,00 $ → 14,00 $).
  Le champ reste modifiable ; une fois modifié à la main, le coûtant ne
  l'écrase plus.
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
