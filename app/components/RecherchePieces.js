"use client";

import { useEffect, useState } from "react";
import { lienRecherche, lienRechercheTous, texteVehicule } from "@/lib/recherchePieces";

// Fenêtre « Rechercher des pièces » d'un bon : le véhicule et son NIV (à
// copier dans le catalogue d'un fournisseur), un bouton par fournisseur qui
// ouvre son site sur la pièce ou le véhicule, et une recherche Google chez
// tous à la fois. Voir lib/recherchePieces.js.
export default function RecherchePieces({ vehicule, sites, pieceInitiale = "", onFermer }) {
  const [piece, setPiece] = useState(pieceInitiale);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    function surTouche(e) { if (e.key === "Escape") onFermer(); }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  async function copierNiv() {
    try {
      await navigator.clipboard.writeText(vehicule.niv);
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    } catch {
      // Presse-papiers refusé : le NIV reste sélectionnable à la main
    }
  }

  // Entrée : le premier fournisseur de la liste
  function ouvrirPremier(e) {
    e.preventDefault();
    const lien = sites.length ? lienRecherche(sites[0], piece, vehicule) : lienRechercheTous(sites, piece, vehicule);
    window.open(lien, "_blank", "noopener,noreferrer");
  }

  function chercherPartout() {
    if (!piece.trim()) return;
    window.open(lienRechercheTous(sites, piece, vehicule), "_blank", "noopener,noreferrer");
  }

  const libelle = texteVehicule(vehicule);
  const aRecherche = piece.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}
    >
      <div style={{ width: "100%", maxWidth: 560, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong style={{ fontSize: 15 }}>🔎 Rechercher des pièces</strong>
          <button onClick={onFermer} aria-label="Fermer" style={{ background: "none", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "5px 11px", fontSize: 12, cursor: "pointer" }}>
            Fermer
          </button>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>🚗 {libelle || "Véhicule"}</div>
          {vehicule.niv ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", userSelect: "all", overflowWrap: "anywhere" }}>NIV {vehicule.niv}</span>
              <button type="button" onClick={copierNiv} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                {copie ? "Copié ✓" : "Copier le NIV"}
              </button>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", marginTop: 4 }}>Pas de NIV au dossier — la recherche se fait avec l'année, la marque et le modèle.</div>
          )}
        </div>

        <form onSubmit={ouvrirPremier} style={{ marginBottom: 12 }}>
          <input
            value={piece}
            onChange={(e) => setPiece(e.target.value)}
            placeholder="Pièce recherchée — ex. : plaquettes de frein avant"
            autoFocus
            maxLength={150}
            className="champ"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </form>

        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Ouvrir le site du fournisseur :</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {sites.map((s, i) => (
            <a
              key={i}
              href={lienRecherche(s, piece, vehicule)}
              target="_blank"
              rel="noopener noreferrer"
              className="bouton-3d"
              style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}
            >
              ↗ {s.nom}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={chercherPartout}
          disabled={!aRecherche}
          style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "1px dashed var(--border)", borderRadius: 8, padding: "6px 12px", cursor: aRecherche ? "pointer" : "default", opacity: aRecherche ? 1 : 0.5 }}
        >
          🔎 Chercher chez tous les fournisseurs à la fois (Google)
        </button>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
          Sur le site du fournisseur, choisis le véhicule (colle le NIV copié ci-dessus s'il le demande) pour voir les pièces qui lui conviennent.
        </p>
      </div>
    </div>
  );
}
