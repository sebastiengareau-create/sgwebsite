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
