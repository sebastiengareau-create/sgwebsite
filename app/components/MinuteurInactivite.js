"use client";

import { useEffect, useRef } from "react";

const DELAI_INACTIVITE_MS = 120 * 60 * 1000; // 120 minutes sans aucune action
const INTERVALLE_VERIF_MS = 60 * 1000; // vérifie une fois par minute
const EVENEMENTS_ACTIVITE = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
// Dernière activité partagée entre les onglets : un onglet oublié en arrière-
// plan ne doit pas déconnecter quelqu'un qui travaille dans un autre (la
// session est commune à tous les onglets).
const CLE_ACTIVITE = "derniere-activite";
const INTERVALLE_PARTAGE_MS = 15 * 1000;

function activitePartagee() {
  try { return Number(localStorage.getItem(CLE_ACTIVITE)) || 0; } catch { return 0; }
}

// Déconnecte automatiquement après une période d'inactivité — sauf si le
// poinçon (horodateur) de l'employé est actif, pour ne jamais couper
// quelqu'un qui travaille sans toucher au logiciel (ex. mécanicien sur un
// bon, téléphone dans la poche).
export default function MinuteurInactivite() {
  const derniereActiviteRef = useRef(Date.now());

  useEffect(() => {
    let dernierPartage = 0;
    function marquerActivite() {
      const maintenant = Date.now();
      derniereActiviteRef.current = maintenant;
      if (maintenant - dernierPartage < INTERVALLE_PARTAGE_MS) return;
      dernierPartage = maintenant;
      try { localStorage.setItem(CLE_ACTIVITE, String(maintenant)); } catch {}
    }
    marquerActivite();
    EVENEMENTS_ACTIVITE.forEach((e) => window.addEventListener(e, marquerActivite, { passive: true }));

    const intervalle = setInterval(async () => {
      const derniere = Math.max(derniereActiviteRef.current, activitePartagee());
      if (Date.now() - derniere < DELAI_INACTIVITE_MS) return;
      try {
        const res = await fetch("/api/moi/horodateur-actif");
        if (!res.ok) return; // session déjà expirée ou erreur — n'agit pas soi-même
        const { actif } = await res.json();
        if (actif) return; // poinçon actif — jamais déconnecté pour inactivité
      } catch {
        return; // en cas d'erreur réseau, ne prend pas de risque
      }
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      window.location.href = "/login?deconnecte=inactivite";
    }, INTERVALLE_VERIF_MS);

    return () => {
      EVENEMENTS_ACTIVITE.forEach((e) => window.removeEventListener(e, marquerActivite));
      clearInterval(intervalle);
    };
  }, []);

  return null;
}
