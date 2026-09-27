# Clients

Un seul code, sur la branche **`main`** — le modèle de base, neutre. Chaque
client est une **installation séparée** (son projet Railway, sa base de
données, ses secrets) qui roule ce même code, avec son **profil** choisi par
la variable Railway `NEXT_PUBLIC_CLIENT`.

| Client | `NEXT_PUBLIC_CLIENT` | Fiche |
|---|---|---|
| Modèle de base (démo, nouvelles ventes) | *(vide)* ou `template` | — |
| VR Premium | `vr-premium` | [vr-premium/CLIENT.md](vr-premium/CLIENT.md) |

## Où vit ce qui distingue un client

- **Comportement** (type de véhicules, règles…) : son profil dans
  `lib/client.js`. Le code lit le profil ; il n'y a jamais de copie du code
  propre à un client.
- **Logos et icônes** : `public/clients/<id>/` (listés dans `images` du
  profil). Les images absentes viennent de `public/`.
- **Nom, adresse, téléphone…** : dans l'appli (Administrateur →
  Informations de l'entreprise), donc dans la base du client.
- **Contexte** : `clients/<id>/CLIENT.md` — qui est le client, ce qui le
  distingue et pourquoi.

## Règles pour Claude

- Quand on dit travailler « pour » un client, lis sa fiche `CLIENT.md`.
- Une amélioration générale se code pour tous. Un besoin propre à un client
  devient un **réglage de profil** (valeur par défaut = comportement du
  modèle de base), jamais un `if (client === "…")` dispersé dans le code, ni
  une branche à part.
- Chaque nouveau réglage : l'ajouter à `TEMPLATE` dans `lib/client.js` avec
  un commentaire, l'activer dans le profil du client, et le noter dans sa
  fiche.
- Les migrations Prisma sont communes à tous : elles s'appliquent à chaque
  client à son prochain déploiement.
