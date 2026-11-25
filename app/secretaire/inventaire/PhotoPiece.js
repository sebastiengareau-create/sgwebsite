"use client";

import { useEffect, useState } from "react";
import { compresserImage } from "@/lib/images";
import { LARGEUR_PHOTO_PIECE, QUALITE_PHOTO_PIECE, urlPhotoPiece } from "@/lib/photoPiece";
import { useChoixPhoto } from "../../components/ChoixPhoto";
import { Icone, TEINTES, BoutonAction, stylePanneau } from "../../components/StyleSection";

const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });
const compresser = (file) => compresserImage(file, LARGEUR_PHOTO_PIECE, QUALITE_PHOTO_PIECE);

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
      const res = await fetch(`/api/inventaire/${pieceId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: await compresser(file) }),
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
      <LignePhoto
        src={photoLe ? urlPhotoPiece(pieceId, photoLe) : null}
        sousTitre={photoLe ? `Prise le ${dateCourte(photoLe)}` : "Aucune — facultative, pour reconnaître la pièce au besoin."}
        onAgrandir={onAgrandir} onPrendre={modifiable ? choix.ouvrir : null} onRetirer={retirer} enCours={enCours}
      />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
      {choix.element}
    </div>
  );
}

// Formulaire « Nouvelle pièce » : la photo est prise avant que la pièce
// existe, gardée ici (dataUrl compressée, valeur) et envoyée avec la
// création (POST /api/inventaire, champ photo).
export function ChampPhotoNouvellePiece({ valeur, onChange }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [agrandie, setAgrandie] = useState(false);
  const choix = useChoixPhoto(([f]) => prendre(f));

  async function prendre(file) {
    setErreur("");
    setEnCours(true);
    try {
      onChange(await compresser(file));
    } catch (e) {
      setErreur("Impossible de traiter cette photo : " + e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div style={{ padding: 10, borderRadius: 12, border: `1px ${valeur ? "solid" : "dashed"} var(--border)`, background: "var(--bg)", marginBottom: 14 }}>
      <LignePhoto
        src={valeur || null} taille={56}
        sousTitre={valeur ? "Sera gardée sur la fiche de la pièce." : "Facultative — pour reconnaître la pièce au besoin."}
        onAgrandir={() => setAgrandie(true)} onPrendre={choix.ouvrir} onRetirer={() => onChange("")} enCours={enCours}
      />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
      {agrandie && valeur && <VisionneusePhotoPiece src={valeur} onFermer={() => setAgrandie(false)} />}
      {choix.element}
    </div>
  );
}

// Vignette (ou case vide), titre et boutons. onPrendre absent : pas de prise
// de photo (réglage inactif) ; « Retirer » seulement s'il y a une photo.
function LignePhoto({ src, sousTitre, onAgrandir, onPrendre, onRetirer, enCours, taille = 72 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      {src ? (
        <button type="button" onClick={onAgrandir} title="Voir en grand" style={{ padding: 0, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface-alt)", cursor: "zoom-in", flexShrink: 0 }}>
          <img src={src} alt="Photo de la pièce" style={{ display: "block", width: taille, height: taille, objectFit: "cover" }} />
        </button>
      ) : (
        <button
          type="button" onClick={onPrendre || undefined} disabled={!onPrendre || enCours} aria-label="Prendre une photo"
          style={{ flexShrink: 0, width: taille, height: taille, borderRadius: 12, border: "1px dashed var(--border)", background: "var(--surface)", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, cursor: onPrendre ? "pointer" : "default" }}
        >
          <Icone nom="camera" taille={Math.round(taille * 0.36)} couleur="var(--text-muted)" />
        </button>
      )}
      <div style={{ flex: "1 1 160px", minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Photo de la pièce</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{sousTitre}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {src && <BoutonAction icone="loupe" compact onClick={onAgrandir}>Voir en grand</BoutonAction>}
        {onPrendre && (
          <BoutonAction icone="camera" compact onClick={onPrendre} disabled={enCours} couleur={TEINTES.bleu.couleur}>
            {enCours ? "…" : src ? "Reprendre" : "Prendre une photo"}
          </BoutonAction>
        )}
        {src && <BoutonAction icone="poubelle" compact couleur="var(--danger)" onClick={onRetirer} disabled={enCours}>Retirer</BoutonAction>}
      </div>
    </div>
  );
}

// La photo en plein écran, par-dessus la page ; un clic ou Échap la ferme.
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
