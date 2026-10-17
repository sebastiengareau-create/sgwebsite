"use client";

import { useRef, useState } from "react";
import { compresserImage } from "@/lib/images";
import { POSITIONS_ARRIVEE, urlPhotoArrivee } from "@/lib/photosArrivee";

// Photos du véhicule à l'arrivée (voir lib/photosArrivee.js) : 4 coins et
// tableau de bord, compressées fort avant l'envoi (simple référence de l'état
// du véhicule : 800 px, JPEG qualité 0,5 — environ 50 à 80 Ko chacune).
const compresser = (file) => compresserImage(file, 800, 0.5);

// Nouveau bon : les photos sont prises avant que le bon existe, gardées ici
// (valeurs : { position: dataUrl }) et envoyées après sa création.
export function PrisePhotosArrivee({ valeurs, onChange }) {
  const [enCours, setEnCours] = useState("");
  const [erreur, setErreur] = useState("");

  async function prendre(position, file) {
    setErreur("");
    setEnCours(position);
    try {
      onChange({ ...valeurs, [position]: await compresser(file) });
    } catch (e) {
      setErreur("Impossible de traiter cette photo : " + e.message);
    } finally {
      setEnCours("");
    }
  }

  return (
    <>
      <GrillePhotos
        cases={POSITIONS_ARRIVEE.map((p) => ({ ...p, src: valeurs[p.cle] || null }))}
        enCours={enCours}
        modifiable
        onFichier={prendre}
      />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erreur}</p>}
    </>
  );
}

// Bon de travail : repliées en haut du bon, ouvertes sur demande. Chaque
// photo s'ouvre en grand dans un nouvel onglet ; une photo manquante peut
// s'ajouter tant que le bon n'est pas facturé.
export function PhotosArriveeBon({ bonId, photos, modifiable }) {
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState(photos);
  const [enCours, setEnCours] = useState("");
  const [erreur, setErreur] = useState("");

  if (!liste.length && !modifiable) return null;

  async function prendre(position, file) {
    setErreur("");
    setEnCours(position);
    try {
      const res = await fetch(`/api/bons/${bonId}/photos-arrivee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position, dataUrl: await compresser(file) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.erreur || `Le serveur a refusé la photo (code ${res.status}).`);
        return;
      }
      setListe((l) => [...l.filter((p) => p.position !== position), data]);
    } catch (e) {
      setErreur("Impossible de traiter cette photo : " + e.message);
    } finally {
      setEnCours("");
    }
  }

  const cases = POSITIONS_ARRIVEE.map((p) => {
    const photo = liste.find((x) => x.position === p.cle);
    return { ...p, src: photo ? urlPhotoArrivee(bonId, p.cle, String(photo.ajouteeLe)) : null };
  });

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 11px", cursor: "pointer" }}
      >
        📷 Photos du véhicule à l'arrivée ({liste.length}/{POSITIONS_ARRIVEE.length}) {ouvert ? "▴" : "▾"}
      </button>
      {ouvert && (
        <div style={{ marginTop: 8 }}>
          <GrillePhotos cases={cases} enCours={enCours} modifiable={modifiable} onFichier={prendre} lienAgrandir />
          {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erreur}</p>}
        </div>
      )}
    </div>
  );
}

function GrillePhotos({ cases, enCours, modifiable, onFichier, lienAgrandir = false }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 4 }}>
      {cases.map((c) => (
        <CasePhoto key={c.cle} {...c} enCours={enCours === c.cle} modifiable={modifiable} onFichier={(f) => onFichier(c.cle, f)} lienAgrandir={lienAgrandir} />
      ))}
    </div>
  );
}

function CasePhoto({ libelle, libelleCourt, src, enCours, modifiable, onFichier, lienAgrandir }) {
  const inputRef = useRef(null);
  const ouvrirCamera = () => inputRef.current?.click();
  const image = src && <img src={src} alt={libelle} style={{ width: "100%", height: 48, objectFit: "cover", borderRadius: 6, display: "block" }} />;

  return (
    <div style={{ background: "var(--surface)", border: `1px solid ${src ? "var(--accent)" : "var(--border)"}`, borderRadius: 6, padding: 3, fontSize: 10, minWidth: 0 }}>
      <div style={{ fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={libelle}>{libelleCourt}</div>
      {src ? (
        lienAgrandir ? <a href={src} target="_blank" rel="noopener noreferrer" title="Ouvrir en grand">{image}</a> : image
      ) : (
        <button
          type="button" onClick={ouvrirCamera} disabled={enCours || !modifiable}
          style={{ width: "100%", height: 48, borderRadius: 6, border: "1px dashed var(--border)", background: "var(--bg)", color: "var(--text-muted)", fontSize: 16, padding: 0, cursor: modifiable ? "pointer" : "default" }}
        >
          {enCours ? "…" : modifiable ? "📷" : "—"}
        </button>
      )}
      {src && modifiable && (
        <button type="button" onClick={ouvrirCamera} disabled={enCours} style={{ marginTop: 2, width: "100%", fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {enCours ? "…" : "Reprendre"}
        </button>
      )}
      <input
        ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFichier(f); e.target.value = ""; }}
      />
    </div>
  );
}
