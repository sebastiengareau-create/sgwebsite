"use client";

import { useEffect, useRef, useState } from "react";

// Formats lus : le QR des étiquettes de l'appli, les codes des fabricants
// (UPC/EAN) et ceux des fournisseurs (code 128/39).
const FORMATS_NATIFS = ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "data_matrix"];

// Fenêtre plein écran qui ouvre la caméra arrière et rend le premier code lu.
// Le lecteur intégré au navigateur (BarcodeDetector, Android/Chrome) est
// utilisé quand il existe ; sinon (iPhone) la librairie ZXing prend le relais.
// Un champ permet aussi de taper le code, ou de le saisir avec une douchette
// USB/Bluetooth, qui se comporte comme un clavier.
export default function ScannerCodeBarres({ titre = "Scanner un code", onDetecte, onFermer }) {
  const videoRef = useRef(null);
  const [erreur, setErreur] = useState("");
  const [saisie, setSaisie] = useState("");
  const termine = useRef(false);
  const rappel = useRef(onDetecte);
  rappel.current = onDetecte;

  useEffect(() => {
    let flux = null;
    let controlesZxing = null;
    let minuterie = null;
    let annule = false;

    function detecte(texte) {
      if (termine.current || !texte) return;
      termine.current = true;
      navigator.vibrate?.(80);
      arreter();
      rappel.current(texte);
    }

    function arreter() {
      clearInterval(minuterie);
      controlesZxing?.stop();
      flux?.getTracks().forEach((t) => t.stop());
    }

    async function demarrer() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErreur("La caméra n'est pas accessible ici — elle demande une connexion sécurisée (https). Tape le code ci-dessous.");
        return;
      }
      try {
        const formatsOfferts = "BarcodeDetector" in window ? await window.BarcodeDetector.getSupportedFormats() : [];
        const formats = FORMATS_NATIFS.filter((f) => formatsOfferts.includes(f));
        if (formats.includes("qr_code")) {
          flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (annule) return arreter();
          const video = videoRef.current;
          video.srcObject = flux;
          await video.play();
          const detecteur = new window.BarcodeDetector({ formats });
          let occupe = false;
          minuterie = setInterval(async () => {
            if (occupe || video.readyState < 2) return;
            occupe = true;
            try {
              const codes = await detecteur.detect(video);
              if (codes.length > 0) detecte(codes[0].rawValue);
            } catch {}
            occupe = false;
          }, 150);
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (annule) return;
          const lecteur = new BrowserMultiFormatReader();
          controlesZxing = await lecteur.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            videoRef.current,
            (resultat) => { if (resultat) detecte(resultat.getText()); }
          );
          if (annule) arreter();
        }
      } catch (e) {
        setErreur(
          e?.name === "NotAllowedError"
            ? "Accès à la caméra refusé — autorise-le dans les réglages du navigateur, ou tape le code ci-dessous."
            : e?.name === "NotFoundError"
              ? "Aucune caméra trouvée sur cet appareil. Tape le code ci-dessous."
              : "Impossible de démarrer la caméra. Tape le code ci-dessous."
        );
      }
    }

    demarrer();
    return () => { annule = true; arreter(); };
  }, []);

  function validerSaisie(e) {
    e.preventDefault();
    const texte = saisie.trim();
    if (!texte || termine.current) return;
    termine.current = true;
    onDetecte(texte);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, color: "#fff" }}>
          <strong style={{ fontSize: 15 }}>📷 {titre}</strong>
          <button onClick={onFermer} aria-label="Fermer" style={{ background: "none", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
            Fermer
          </button>
        </div>

        <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 4", maxHeight: "60vh", background: "#000", borderRadius: 12, overflow: "hidden" }}>
          <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          {!erreur && (
            <div style={{ position: "absolute", inset: "22% 12%", border: "3px solid var(--accent, #C9A227)", borderRadius: 12, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)", pointerEvents: "none" }} />
          )}
        </div>
        <p style={{ color: erreur ? "#ff9a8a" : "rgba(255,255,255,0.75)", fontSize: 12.5, margin: "10px 0" }}>
          {erreur || "Place le QR de l'étiquette ou le code-barres de la boîte dans le cadre."}
        </p>

        <form onSubmit={validerSaisie} style={{ display: "flex", gap: 6 }}>
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="…ou tape le code / numéro"
            autoFocus={!!erreur}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 14 }}
          />
          <button type="submit" className="bouton-3d" style={{ padding: "0 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>OK</button>
        </form>
      </div>
    </div>
  );
}
