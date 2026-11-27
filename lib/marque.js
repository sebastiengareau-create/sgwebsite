// ============================================================
// MARQUE DU LOGICIEL — kontrolshop
// ============================================================
// Le nom, le slogan et les couleurs du logiciel lui-même, pareils pour
// toutes les installations. À ne pas confondre avec le nom et le logo du
// client (lib/config.js, image("logo.png")), qui restent en vedette
// partout : la marque kontrolshop reste discrète (bas de la page de
// connexion, Paramètres → À propos), jamais sur les documents du client.
//
// Le secteur (badge GARAGE, FERME…) vient du profil : CLIENT.secteurMarque.
// ============================================================

import { CLIENT } from "./client";

export const NOM_LOGICIEL = "kontrolshop";
export const SLOGAN = "Tout est sous kontrol.";
export const COURRIEL_SOUTIEN = "info@kontrolshop.com";
// Site de vente (dépôt à part kontrolshop.com) : lien de la signature au bas
// de la page de connexion et de Paramètres → À propos
export const SITE_WEB = "https://www.kontrolshop.com";

// Couleur de l'aiguille et du badge, propre à chaque secteur. Les logos en
// fichiers (pages d'accueil, site de vente) sont dans public/marque/ :
// <secteur>[-horizontal]-<clair|sombre>.svg, et « kontrolshop-… » sans badge.
// Générés par scripts/logos-kontrolshop.py — garder les couleurs pareilles.
// Logo métal (aiguille, chrome) : public/marque/kontrolshop-metal-<secteur>.png
// (garage, ferme, copropriete, immobilier, premium), déclinés avec
// scripts/logo-metal/.
export const SECTEURS = {
  garage: { libelle: "Garage", couleur: "#e07338" },
  ferme: { libelle: "Ferme", couleur: "#457a3c" },
  copropriete: { libelle: "Copropriété", couleur: "#2f6db5" },
  immobilier: { libelle: "Immobilier", couleur: "#7c4dbd" },
  boutique: { libelle: "Boutique", couleur: "#c2416b" },
  premium: { libelle: "Premium", couleur: "#b8902f" },
};

export const SECTEUR = SECTEURS[CLIENT.secteurMarque] || SECTEURS.garage;
const cleSecteur = SECTEURS[CLIENT.secteurMarque] ? CLIENT.secteurMarque : "garage";

// Adresses des démos, une par déclinaison, dans la variable
// NEXT_PUBLIC_DEMOS (la même dans chaque service de démo, ex. variable
// partagée du projet Railway) : « garage=https://demo.kontrolshop.com,
// ferme=https://ferme.demo.kontrolshop.com,… ». Intégrée au build.
export function lireAdressesDemos(texte) {
  const adresses = {};
  for (const morceau of (texte || "").split(",")) {
    const i = morceau.indexOf("=");
    if (i < 1) continue;
    const cle = morceau.slice(0, i).trim();
    const url = morceau.slice(i + 1).trim();
    if (SECTEURS[cle] && /^https?:\/\//.test(url)) adresses[cle] = url;
  }
  return adresses;
}
const ADRESSES_DEMOS = lireAdressesDemos(process.env.NEXT_PUBLIC_DEMOS);

// Écran de connexion d'une démo (profil ecranDemo) : les autres
// déclinaisons sous le logo, en texte de leur couleur — un lien vers leur
// démo quand son adresse est dans NEXT_PUBLIC_DEMOS
export const DECLINAISONS_DEMO = ["garage", "ferme", "copropriete", "immobilier", "premium"]
  .filter((cle) => cle !== cleSecteur)
  .map((cle) => ({ ...SECTEURS[cle], cle, url: ADRESSES_DEMOS[cle] || null }));

// Logo métal du secteur (PNG transparent, lisible en thème clair comme
// sombre), montré dans Paramètres → À propos ; null pour un secteur qui
// n'en a pas (boutique) : le logo dessiné (LogoKontrolshop) le remplace.
const SECTEURS_METAL = ["garage", "ferme", "copropriete", "immobilier", "premium"];
export const LOGO_METAL = SECTEURS_METAL.includes(cleSecteur) ? `/marque/kontrolshop-metal-${cleSecteur}.png` : null;
