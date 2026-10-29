"use client";

import { useRef, useState } from "react";

// Choix de la source d'une photo. Un simple <input accept="image/*"> ouvre,
// sur Android 14 et plus, le sélecteur de photos du système : galerie
// seulement, sans caméra (iPhone, lui, offre son propre menu). Sur un écran
// tactile, on propose donc nous-mêmes « Prendre une photo » (caméra directe,
// via capture) ou « Choisir une photo » ; à l'ordinateur, le sélecteur de
// fichiers s'ouvre directement.
//
// Usage : const photo = useChoixPhoto((fichiers) => …, { multiple });
//         <button onClick={photo.ouvrir}>📷</button> … {photo.element}
export function useChoixPhoto(onFichiers, { multiple = false } = {}) {
  const cameraRef = useRef(null);
  const galerieRef = useRef(null);
  const [menu, setMenu] = useState(false);

  function ouvrir() {
    const tactile = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (tactile) setMenu(true);
    else galerieRef.current?.click();
  }

  function choisir(ref) {
    setMenu(false);
    ref.current?.click();
  }

  const recevoir = (e) => {
    const fichiers = Array.from(e.target.files || []);
    e.target.value = "";
    if (fichiers.length) onFichiers(fichiers);
  };

  const element = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={recevoir} />
      <input ref={galerieRef} type="file" accept="image/*" multiple={multiple} style={{ display: "none" }} onChange={recevoir} />
      {menu && (
        <div
          onClick={() => setMenu(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 420, margin: 12, display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div style={{ background: "var(--surface)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
              <button type="button" onClick={() => choisir(cameraRef)} style={optionStyle}>📷 Prendre une photo</button>
              <button type="button" onClick={() => choisir(galerieRef)} style={{ ...optionStyle, borderTop: "1px solid var(--border)" }}>
                🖼️ Choisir {multiple ? "des photos" : "une photo"}
              </button>
            </div>
            <button type="button" onClick={() => setMenu(false)} style={{ ...optionStyle, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 700 }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );

  return { ouvrir, element };
}

const optionStyle = {
  display: "block", width: "100%", padding: "14px 16px", fontSize: 15, textAlign: "center",
  background: "var(--surface)", color: "var(--text)", border: "none", cursor: "pointer",
};
