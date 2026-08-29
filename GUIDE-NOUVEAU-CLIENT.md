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

### 4. Initialiser la base de données de ce client
Depuis le dossier du nouveau client, avec le tunnel Railway comme on l'a
fait la première fois :
```
npx prisma migrate dev --name init
```
Puis, au lieu de `npm run seed` (qui crée des comptes de démo fictifs),
crée directement les vrais comptes du client via l'écran de gestion des
employés une fois l'app en ligne — plus propre pour une vraie livraison.

### 5. Déployer
```
railway up
```
Génère le domaine public dans Settings → Networking, comme la première
fois.

## Faire évoluer une fonctionnalité pour TOUS les clients

Comme chaque client a sa propre copie, une amélioration ne se propage pas
automatiquement. Le processus :
1. Développe et teste la nouvelle fonctionnalité dans `template-de-base`
2. Une fois satisfait, applique le même changement de code dans chaque
   dossier `client-...` (copier les fichiers modifiés)
3. Redéploie chaque client individuellement (`railway up` dans son dossier)

C'est plus de manutention qu'un vrai système "multi-tenant" (un seul
logiciel qui sert tous les clients à la fois), mais c'est **beaucoup plus
simple à opérer et bien plus sécuritaire** au début. On pourra migrer vers
une architecture multi-tenant plus tard si le nombre de clients grandit
beaucoup et que la manutention devient lourde.
