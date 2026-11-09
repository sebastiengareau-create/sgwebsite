# Site www.kontrolshop.com

Site de vente du logiciel kontrolshop : une seule page statique (HTML, CSS et
un peu de JavaScript, sans dépendance ni compilation). **À part de l'appli** :
il n'est pas servi par les installations des clients et ne lit aucune base.

```
index.html     la page (styles et script inclus)
img/           logos métal des déclinaisons (WebP), logo, icônes
robots.txt, sitemap.xml
```

## Voir le site sur son ordinateur

Ouvrir `index.html` dans le navigateur, tout simplement.

## Modifier

- **Textes** : directement dans `index.html` (sections `#declinaisons`,
  `#points-forts`, `#exemple`, `#questions`, `#contact`).
- **Couleurs des déclinaisons** : variables `--garage`, `--ferme`, `--copro`,
  `--premium` en haut du `<style>` — garder celles de `lib/marque.js`.
- **Logos** : générés depuis `public/marque/kontrolshop-metal-<secteur>.png` :
  `convert … -resize 820x -strip -quality 82 img/metal-<secteur>.webp`.
- **Courriel de contact** : `info@sgwebsite.online` (3 endroits dans
  `index.html`). Le formulaire ouvre le logiciel de courriel du visiteur,
  déjà rempli — pas de serveur à entretenir.

## Mettre en ligne sur Railway

1. Railway → **New Project** → *Deploy from GitHub repo* → ce dépôt, branche `main`.
2. Service → Settings → **Root Directory** : `site-kontrolshop`. Railway
   reconnaît un site statique (`index.html` à la racine) et le sert avec Caddy.
3. Settings → Networking → **Custom Domain** : `www.kontrolshop.com`, puis
   chez le registraire du domaine, ajouter l'enregistrement **CNAME** indiqué
   par Railway (`www` → `….up.railway.app`).
4. Rediriger `kontrolshop.com` (sans www) vers `https://www.kontrolshop.com`
   avec la redirection d'URL du registraire.

Chaque fusion dans `main` qui touche ce dossier redéploie le site. Ça
n'affecte jamais les installations des clients (elles suivent leurs branches
`client/<id>`). Fonctionne aussi tel quel sur Netlify, Cloudflare Pages ou
GitHub Pages.
