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
export const COURRIEL_SOUTIEN = "info@sgwebsite.online";

// Couleur de l'aiguille et du badge, propre à chaque secteur. Les logos en
// fichiers (pages d'accueil, site de vente) sont dans public/marque/ :
// <secteur>[-horizontal]-<clair|sombre>.svg, et « kontrolshop-… » sans badge.
// Générés par scripts/logos-kontrolshop.py — garder les couleurs pareilles.
// Logo métal (aiguille, chrome) : public/marque/kontrolshop-metal-<secteur>.png
// (garage, ferme, copropriete, premium), déclinés avec scripts/logo-metal/.
export const SECTEURS = {
  garage: { libelle: "Garage", couleur: "#e07338" },
  ferme: { libelle: "Ferme", couleur: "#457a3c" },
  copropriete: { libelle: "Copropriété", couleur: "#2f6db5" },
  boutique: { libelle: "Boutique", couleur: "#c2416b" },
  premium: { libelle: "Premium", couleur: "#b8902f" },
};

export const SECTEUR = SECTEURS[CLIENT.secteurMarque] || SECTEURS.garage;

// Logo métal du secteur (PNG transparent, lisible en thème clair comme
// sombre), montré dans Paramètres → À propos ; null pour un secteur qui
// n'en a pas (boutique) : le logo dessiné (LogoKontrolshop) le remplace.
const SECTEURS_METAL = ["garage", "ferme", "copropriete", "premium"];
const cleSecteur = SECTEURS[CLIENT.secteurMarque] ? CLIENT.secteurMarque : "garage";
export const LOGO_METAL = SECTEURS_METAL.includes(cleSecteur) ? `/marque/kontrolshop-metal-${cleSecteur}.png` : null;
