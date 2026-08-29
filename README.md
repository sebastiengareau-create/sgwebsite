# Garage Tremblay & Fils — Backend

Base réelle avec authentification et 3 rôles (Gérant, Secrétaire, Mécanicien).
C'est la suite du prototype visuel — les mêmes écrans seront reconnectés ici
étape par étape.

## Lancer le projet chez toi

Il te faut Node.js installé (version 18 ou plus). Ensuite, dans ce dossier :

```bash
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Ouvre http://localhost:3000 — tu seras redirigé vers la page de connexion.

## Comptes de démo (créés par `npm run seed`)

| Rôle | Courriel | Mot de passe |
|---|---|---|
| Gérant | gerant@garage.com | gerant123 |
| Secrétaire | secretaire@garage.com | secretaire123 |
| Mécanicien | mecanicien@garage.com | mecanicien123 |

Le gérant a accès à `/gerant`, `/secretaire` ET `/mecanicien`.
La secrétaire et le mécanicien sont automatiquement bloqués hors de leur espace
(essaie de visiter `/gerant` connecté comme mécanicien — tu seras renvoyé).

## Ce qui fonctionne déjà (branché sur la vraie base de données)

- Connexion / déconnexion avec mots de passe hachés
- Protection des routes par rôle (middleware.js)
- **Horodateur réel** : le mécanicien peut démarrer/arrêter un poinçon sur un
  bon qui lui est assigné — ça écrit vraiment dans la base (table `EntreeTemps`)
- Vue d'ensemble du gérant (comptes, bons, alertes de stock)
- Liste des bons pour la secrétaire

## Prochaine étape

Porter les écrans détaillés du prototype (lignes de problèmes + photos,
ajout de pièces avec déduction d'inventaire, filtre par statut) dans
`/secretaire` et `/mecanicien`, branchés sur cette même base de données.

## Structure

```
prisma/schema.prisma   → les tables (User, BonTravail, Piece, EntreeTemps, etc.)
prisma/seed.js         → données de démo (3 comptes + inventaire + 1 bon)
lib/auth.js            → sessions, mots de passe, vérification de rôle
middleware.js          → bloque l'accès aux mauvaises sections
app/login/              → page de connexion
app/gerant/              → espace gérant
app/secretaire/          → espace secrétaire
app/mecanicien/          → espace mécanicien + horodateur
```
