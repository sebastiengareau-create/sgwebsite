"use client";

import { useRouter } from "next/navigation";

// Bouton ✕ des pages à imprimer (factures, rapports, talons…). Elles
// s'ouvrent dans un nouvel onglet : sur cellulaire, et surtout dans l'appli
// installée à l'écran d'accueil, il n'y a alors aucun moyen visible de
// revenir au logiciel. Le bouton ferme l'onglet ; si le navigateur refuse,
// il revient à la page précédente, ou à `retour` s'il n'y en a pas.
export default function BoutonFermerPage({ retour = "/" }) {
  const router = useRouter();

  function fermer() {
    window.close();
    // Toujours ouvert : le navigateur a refusé de fermer l'onglet
    setTimeout(() => {
      if (window.closed) return;
      if (window.history.length > 1) router.back();
      else router.replace(retour);
    }, 300);
  }

  return (
    <button
      onClick={fermer}
      aria-label="Fermer et revenir au logiciel"
      title="Fermer"
      style={{
        position: "fixed", zIndex: 50,
        top: "calc(env(safe-area-inset-top) + 10px)", left: "calc(env(safe-area-inset-left) + 10px)",
        width: 44, height: 44, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)", fontSize: 20, fontWeight: 700, cursor: "pointer",
      }}
    >
      ✕
    </button>
  );
}
