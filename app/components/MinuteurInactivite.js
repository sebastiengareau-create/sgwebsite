"use client";

import { useEffect, useRef } from "react";

const DELAI_INACTIVITE_MS = 20 * 60 * 1000; // 20 minutes sans aucune action
const INTERVALLE_VERIF_MS = 60 * 1000; // vérifie une fois par minute
const EVENEMENTS_ACTIVITE = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

// Déconnecte automatiquement après une période d'inactivité — sauf si le
// poinçon (horodateur) de l'employé est actif, pour ne jamais couper
// quelqu'un qui travaille sans toucher au logiciel (ex. mécanicien sur un
// bon, téléphone dans la poche).
export default function MinuteurInactivite() {
  const derniereActiviteRef = useRef(Date.now());

  useEffect(() => {
    function marquerActivite() {
      derniereActiviteRef.current = Date.now();
    }
    EVENEMENTS_ACTIVITE.forEach((e) => window.addEventListener(e, marquerActivite, { passive: true }));

    const intervalle = setInterval(async () => {
      if (Date.now() - derniereActiviteRef.current < DELAI_INACTIVITE_MS) return;
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
