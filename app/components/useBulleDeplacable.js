"use client";

import { useEffect, useRef, useState } from "react";

// Bulle flottante (56 px) qu'on déplace en la glissant : elle se range du
// côté gauche ou droit de l'écran, à la hauteur où on la lâche, et cette
// position est mémorisée sur l'appareil. Un simple toucher reste un clic.
// `basMin(cote)` donne la hauteur minimale permise de chaque côté ;
// `onDebut` est appelé quand un glissement commence (ex. fermer un menu).
export default function useBulleDeplacable({ cle, defaut, basMin = () => 20, onDebut }) {
  const [position, setPosition] = useState(defaut);
  const [glissement, setGlissement] = useState(null); // { x, y } pendant qu'on glisse
  const glisseRef = useRef(null); // { x, y, deplace }

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(cle));
      if (p && (p.cote === "gauche" || p.cote === "droite") && Number.isFinite(p.bas)) setPosition(p);
    } catch {}
  }, [cle]);

  function onPointerDown(e) {
    glisseRef.current = { x: e.clientX, y: e.clientY, deplace: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    const g = glisseRef.current;
    if (!g) return;
    if (!g.deplace && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 8) return;
    if (!g.deplace) onDebut?.();
    g.deplace = true;
    setGlissement({ x: e.clientX, y: e.clientY });
  }

  function onPointerUp(e) {
    const g = glisseRef.current;
    if (!g || !g.deplace) { glisseRef.current = null; return; }
    // On garde le drapeau jusqu'au clic qui suit, pour ne pas le déclencher
    setGlissement(null);
    const cote = e.clientX < window.innerWidth / 2 ? "gauche" : "droite";
    const bas = Math.round(Math.min(Math.max(window.innerHeight - e.clientY - 28, basMin(cote)), window.innerHeight - 76));
    const nouvelle = { cote, bas };
    setPosition(nouvelle);
    try { localStorage.setItem(cle, JSON.stringify(nouvelle)); } catch {}
  }

  // À appeler au début du onClick : faux si ce « clic » terminait un glissement
  function estUnClic() {
    const deplace = glisseRef.current?.deplace;
    glisseRef.current = null;
    return !deplace;
  }

  const aDroite = position.cote === "droite";
  const placement = glissement
    ? { left: glissement.x - 28, top: glissement.y - 28 }
    // À gauche, la marge tient compte de la barre latérale (ordinateur,
    // tablette à l'horizontale) : la bulle ne la recouvre jamais, sinon un
    // toucher à côté tombe sur « Déconnexion » (voir globals.css)
    : { bottom: position.bas, ...(aDroite ? { right: 16 } : { left: "var(--marge-bulle-gauche, 16px)" }) };

  return {
    position,
    aDroite,
    placement,
    glissement,
    estUnClic,
    gestionnaires: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
