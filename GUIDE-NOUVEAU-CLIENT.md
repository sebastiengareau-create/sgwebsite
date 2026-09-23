# Guide — Adapter ce logiciel à un nouveau client

Ce projet est conçu comme un **modèle** (template). Chaque client reçoit sa
propre copie complète et indépendante — sa propre base de données, son
propre hébergement, ses propres comptes. Rien n'est partagé entre les
clients ; c'est le moyen le plus simple et le plus sûr de vendre ce
logiciel à plusieurs garages sans risquer que les données d'un client
se mélangent avec celles d'un autre.

## Structure de dossiers recommandée sur ton ordinateur

```
Mes Logiciels Garage/
├── template-de-base/          ← NE JAMAIS MODIFIER DIRECTEMENT — la version
│                                  propre et vierge, toujours à jour avec les
│                                  dernières fonctionnalités
├── client-vr-premium/          ← copie du template pour VR Premium
├── client-garage-xyz/          ← copie du template pour un futur client
└── client-garage-abc/          ← etc.
```

Le dossier `template-de-base` reste toujours "neutre" — logo générique,
aucune vraie donnée. C'est celui que tu copies à chaque nouvelle vente.

## Étapes pour créer une nouvelle installation

### 1. Copier le modèle
Copie le dossier `template-de-base` complet, renomme la copie
`client-nom-du-garage`.

### 2. Adapter la marque (2 minutes)
Dans le nouveau dossier, ouvre **`lib/config.js`** — c'est le SEUL fichier
à modifier pour la marque :

```javascript
module.exports = {
  nomEntreprise: "Nom Du Nouveau Garage",
  descriptionCourte: "Gestion de garage — bons de travail, horodateur, inventaire",
};
```

Remplace ensuite le fichier **`public/logo.png`** par le logo du nouveau
client (même nom de fichier, juste remplacer le contenu).

### 3. Créer l'infrastructure séparée (base de données + hébergement)
Chaque client a son **propre projet Railway complet** :
1. Crée un nouveau projet sur railway.com (ex. "garage-xyz-production")
2. Ajoute un PostgreSQL (`New Project → Provision PostgreSQL`)
3. Crée le service web (`+ New → Empty Service`)
4. Ajoute les variables `DATABASE_URL` (référence vers le Postgres du même
   projet) et `SESSION_SECRET` (nouvelle phrase secrète, différente pour
   chaque client — jamais la même partout)
5. Pour Assistant SG, génère une clé Gemini gratuite sur aistudio.google.com
   (une par client) et ajoute `GEMINI_API_KEY` + `GEMINI_MODEL` (voir le
   `.env` local pour la valeur recommandée du modèle)

### 4. Initialiser la base de données de ce client
Rien à lancer à la main : au démarrage, l'app exécute `prisma migrate deploy`
(voir `npm start`), qui crée toutes les tables sur une base vide à partir de
`prisma/migrations/`. Le premier déploiement (étape 5) initialise donc la base.

Puis, au lieu de `npm run seed` (qui crée des comptes de démo fictifs),
crée directement les vrais comptes du client via l'écran de gestion des
employés une fois l'app en ligne — plus propre pour une vraie livraison.

### 5. Déployer
Les déploiements se font depuis GitHub, sans `railway up` : tout le code
vit dans le dépôt `sebastiengareau-create/sgwebsite`, une branche par
installation (`main` = template, `client-vr-premium` = VR Premium, etc.).
1. Crée la branche du client à partir de `main` et pousse-la sur GitHub.
2. Dans le service web Railway : Settings → Source → **Connect Repo** →
   `sgwebsite`, puis mets « Branch connected to production » sur la branche
   du client. Laisse **Root Directory** vide (le dépôt commence directement
   au dossier du projet).
3. Chaque `git push` sur cette branche redéploie ensuite ce client, et
   seulement lui.

(Le compte Railway doit être relié au compte GitHub propriétaire du dépôt —
Account Settings — sinon la liste des dépôts reste vide.)

Génère le domaine public dans Settings → Networking, comme la première
fois.

## Faire évoluer une fonctionnalité pour TOUS les clients

Comme chaque client a sa propre copie, une amélioration ne se propage pas
automatiquement. Le processus :
1. Développe et teste la nouvelle fonctionnalité sur `main`
   (`template-de-base`), puis pousse : le template se redéploie tout seul.
2. Une fois satisfait, fusionne `main` dans la branche de chaque client
   (`git merge main` dans son dossier) et pousse cette branche : le client
   se redéploie tout seul, avec ses migrations appliquées au démarrage.

## Changer le schéma de la base (ajouter un champ, une table…)

Plus de `prisma db push` : chaque changement devient une migration versionnée,
appliquée automatiquement au démarrage de l'app (`prisma migrate deploy`).
1. Modifie `prisma/schema.prisma`
2. `npm run migration -- nom_du_changement` — compare la base (lecture seule)
   au schéma et écrit le SQL dans `prisma/migrations/<date>_<nom>/`.
   Relis-le, et ajoute au besoin le remplissage des données existantes.
3. `npx prisma generate`, puis commit, push et déploiement : la migration
   s'applique toute seule au démarrage, sur chaque client lors de son
   prochain déploiement.

Déploie une migration avant d'en créer une autre : le script compare à la
base réelle, qui doit déjà avoir les migrations précédentes.

**Installation existante qui n'avait pas encore de migrations** (base créée
avec `db push`) : avant son premier déploiement avec ce système, marque la
migration de départ comme déjà appliquée, sinon le démarrage échoue parce
que les tables existent déjà :
```
npx prisma migrate resolve --applied 0_init
```
(avec DATABASE_URL pointant vers la base de ce client). Si la branche du
client a des tables à elle (ex. Vehicule), crée-lui sa propre migration de
départ et marque-la aussi comme appliquée.

C'est plus de manutention qu'un vrai système "multi-tenant" (un seul
logiciel qui sert tous les clients à la fois), mais c'est **beaucoup plus
simple à opérer et bien plus sécuritaire** au début. On pourra migrer vers
une architecture multi-tenant plus tard si le nombre de clients grandit
beaucoup et que la manutention devient lourde.
