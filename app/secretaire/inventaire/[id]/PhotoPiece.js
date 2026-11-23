"use client";

import { useEffect, useState } from "react";
import { compresserImage } from "@/lib/images";
import { LARGEUR_PHOTO_PIECE, QUALITE_PHOTO_PIECE, urlPhotoPiece } from "@/lib/photoPiece";
import { useChoixPhoto } from "../../../components/ChoixPhoto";
import { Icone, TEINTES, BoutonAction, stylePanneau } from "../../../components/StyleSection";

const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

// Fiche d'une pièce : sa photo de référence (lib/photoPiece.js). photoLe :
// date de la photo (null s'il n'y en a pas), aussi sa version pour l'adresse.
// modifiable : réglage photoPiece du profil — sans lui, une photo déjà prise
// reste visible et peut être retirée.
export function PanneauPhotoPiece({ pieceId, photoLe, onChange, onAgrandir, modifiable }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const choix = useChoixPhoto(([f]) => prendre(f));

  async function prendre(file) {
    setErreur("");
    setEnCours(true);
    try {
      const dataUrl = await compresserImage(file, LARGEUR_PHOTO_PIECE, QUALITE_PHOTO_PIECE);
      const res = await fetch(`/api/inventaire/${pieceId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.erreur || `Le serveur a refusé la photo (code ${res.status}).`);
        return;
      }
      onChange(data.ajouteeLe);
    } catch (e) {
      setErreur("Impossible de traiter cette photo : " + e.message);
    } finally {
      setEnCours(false);
    }
  }

  async function retirer() {
    if (!window.confirm("Retirer la photo de cette pièce ?")) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${pieceId}/photo`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    onChange(null);
  }

  return (
    <div style={stylePanneau}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {photoLe ? (
          <button type="button" onClick={onAgrandir} title="Voir en grand" style={{ padding: 0, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface-alt)", cursor: "zoom-in", flexShrink: 0 }}>
            <img src={urlPhotoPiece(pieceId, photoLe)} alt="Photo de la pièce" style={{ display: "block", width: 72, height: 72, objectFit: "cover" }} />
          </button>
        ) : (
          <span style={{ flexShrink: 0, width: 72, height: 72, borderRadius: 12, border: "1px dashed var(--border)", background: "var(--bg)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom="camera" taille={26} couleur="var(--text-muted)" />
          </span>
        )}
        <div style={{ flex: "1 1 160px", minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Photo de la pièce</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {photoLe ? `Prise le ${dateCourte(photoLe)}` : "Aucune — facultative, pour reconnaître la pièce au besoin."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {photoLe && <BoutonAction icone="loupe" compact onClick={onAgrandir}>Voir en grand</BoutonAction>}
          {modifiable && (
            <BoutonAction icone="camera" compact onClick={choix.ouvrir} disabled={enCours} couleur={TEINTES.bleu.couleur}>
              {enCours ? "…" : photoLe ? "Reprendre" : "Prendre une photo"}
            </BoutonAction>
          )}
          {photoLe && <BoutonAction icone="poubelle" compact couleur="var(--danger)" onClick={retirer} disabled={enCours}>Retirer</BoutonAction>}
        </div>
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
      {choix.element}
    </div>
  );
}

// La photo en plein écran, par-dessus la fiche ; un clic ou Échap la ferme.
export function VisionneusePhotoPiece({ src, onFermer }) {
  useEffect(() => {
    const touche = (e) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [onFermer]);

  return (
    <div
      onClick={onFermer}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, cursor: "zoom-out" }}
    >
      <img src={src} alt="Photo de la pièce" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
      <button
        type="button" onClick={onFermer} aria-label="Fermer"
        style={{ position: "absolute", top: 12, right: 12, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.18)", color: "#fff", fontSize: 20, cursor: "pointer" }}
      >
        ✕
      </button>
    </div>
  );
}
