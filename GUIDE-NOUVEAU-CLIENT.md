# Guide — Adapter ce logiciel à un nouveau client

Ce projet est un **modèle** (template) vendu à plusieurs garages. Un seul
code — la branche `main` — et une **installation séparée par client** : sa
propre base de données, son propre hébergement, ses propres comptes. Les
données d'un client ne se mélangent jamais avec celles d'un autre.

## Un code, un profil par client

```
main (le modèle, neutre)
 ├── installation « template »    NEXT_PUBLIC_CLIENT vide — démo / nouvelles ventes
 ├── installation VR Premium      NEXT_PUBLIC_CLIENT=vr-premium
 └── installation Garage XYZ      NEXT_PUBLIC_CLIENT=garage-xyz
```

Ce qui distingue un client n'est jamais une copie du code : c'est son
**profil** dans `lib/client.js` (type de véhicules, règles…), ses images
dans `public/clients/<id>/` et sa fiche `clients/<id>/CLIENT.md`. Voir
`clients/README.md`. Sans profil, l'appli se comporte exactement comme le
modèle de base.

Pour une discussion avec Claude sur un client, il suffit de le nommer
(« on travaille pour VR Premium ») : il lit sa fiche.

## Étapes pour créer une nouvelle installation

### 1. Créer le profil du client (si besoin)
Si le client se contente du modèle de base, rien à faire : il n'aura pas de
`NEXT_PUBLIC_CLIENT`. Sinon, sur `main` :
1. Ajoute son profil dans `PROFILS` de **`lib/client.js`** (id en minuscules
   avec des tirets, ex. `garage-xyz`), en ne changeant que ce qui diffère du
   modèle.
2. Mets son logo et ses icônes dans **`public/clients/garage-xyz/`**
   (`logo.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) et
   liste-les dans `images` du profil.
3. Crée sa fiche **`clients/garage-xyz/CLIENT.md`** et ajoute-le au tableau
   de `clients/README.md`.

Le nom, l'adresse et le téléphone de l'entreprise ne sont pas dans le code :
ils se remplissent dans l'appli (Administrateur → Informations de
l'entreprise).

### 2. Créer l'infrastructure séparée (base de données + hébergement)
Chaque client a son **propre projet Railway complet** :
1. Crée un nouveau projet sur railway.com (ex. "garage-xyz-production")
2. Ajoute un PostgreSQL (`New Project → Provision PostgreSQL`)
3. Crée le service web (`+ New → Empty Service`)
4. Ajoute les variables `DATABASE_URL` (référence vers le Postgres du même
   projet) et `SESSION_SECRET` (nouvelle phrase secrète, différente pour
   chaque client — jamais la même partout)
5. Ajoute `NEXT_PUBLIC_CLIENT` avec l'id de son profil (étape 1), s'il en a
   un
6. Pour Assistant SG, génère une clé Gemini gratuite sur aistudio.google.com
   (une par client) et ajoute `GEMINI_API_KEY` + `GEMINI_MODEL` (voir le
   `.env` local pour la valeur recommandée du modèle)
7. Pour la section « Jobs en déplacement » (à activer dans Administrateur →
   Modules), entre le compte Twilio du client dans Administrateur → 📱 SMS
   (Twilio) : Account SID, Auth Token, numéro Twilio et adresse publique de
   l'app (pour le lien du SMS), puis envoie un SMS test. Sans ça, les
   tâches s'envoient quand même, sans texto. Voir `lib/sms.js`.

### 3. Initialiser la base de données de ce client
Rien à lancer à la main : au démarrage, l'app exécute `prisma migrate deploy`
(voir `npm start`), qui crée toutes les tables sur une base vide à partir de
`prisma/migrations/`. Le premier déploiement (étape 4) initialise donc la base.

Puis, au lieu de `npm run seed` (qui crée des comptes de démo fictifs),
crée directement les vrais comptes du client via l'écran de gestion des
employés une fois l'app en ligne — plus propre pour une vraie livraison.

### 4. Déployer
Les déploiements se font depuis GitHub, sans `railway up`.
1. Dans le service web Railway : Settings → Source → **Connect Repo** →
   `sgwebsite`, puis mets « Branch connected to production » sur **`main`**.
   Laisse **Root Directory** vide (le dépôt commence directement au dossier
   du projet).
2. Chaque `git push` sur `main` redéploie ensuite tous les clients.

(Le compte Railway doit être relié au compte GitHub propriétaire du dépôt —
Account Settings — sinon la liste des dépôts reste vide.)

Génère le domaine public dans Settings → Networking, comme la première
fois.

## Faire évoluer une fonctionnalité pour TOUS les clients

Une amélioration poussée sur `main` arrive chez tous les clients à la fois,
sans fusion. En contrepartie, teste-la avant de pousser (sur l'installation
« template », avec `NEXT_PUBLIC_CLIENT` réglé sur chaque profil concerné).

Un besoin propre à un seul client devient un **réglage de son profil** dans
`lib/client.js` : la valeur par défaut garde le comportement du modèle, et
seul ce client l'active.

## Changer le schéma de la base (ajouter un champ, une table…)

Plus de `prisma db push` : chaque changement devient une migration versionnée,
appliquée automatiquement au démarrage de l'app (`prisma migrate deploy`).
1. Modifie `prisma/schema.prisma`
2. `npm run migration -- nom_du_changement` — compare la base (lecture seule)
   au schéma et écrit le SQL dans `prisma/migrations/<date>_<nom>/`.
   Relis-le, et ajoute au besoin le remplissage des données existantes.
3. `npx prisma generate`, puis commit, push et déploiement : la migration
   s'applique toute seule au démarrage, sur chaque client lors de son
   prochain déploiement (c.-à-d. au prochain push sur `main`).

Déploie une migration avant d'en créer une autre : le script compare à la
base réelle, qui doit déjà avoir les migrations précédentes.

**Installation existante qui n'avait pas encore de migrations** (base créée
avec `db push`) : avant son premier déploiement avec ce système, marque la
migration de départ comme déjà appliquée, sinon le démarrage échoue parce
que les tables existent déjà :
```
npx prisma migrate resolve --applied 0_init
```
(avec DATABASE_URL pointant vers la base de ce client).

C'est plus de manutention qu'un vrai système "multi-tenant" (un seul
logiciel qui sert tous les clients à la fois), mais c'est **beaucoup plus
simple à opérer et bien plus sécuritaire** au début. On pourra migrer vers
une architecture multi-tenant plus tard si le nombre de clients grandit
beaucoup et que la manutention devient lourde.
