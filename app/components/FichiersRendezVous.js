"use client";

import { useState } from "react";

// Fichiers joints par le client sur le site de réservation (modèle
// FichierRendezVous) — calendrier et bon créé à partir du rendez-vous.
// 📎 ouvre le fichier ; ⬇️ l'enregistre : sur téléphone ou tablette, la
// feuille de partage du système (Fichiers/iCloud, Google Drive, OneDrive…) ;
// sur ordinateur, un téléchargement (dossier au choix, synchronisé ou non).
export default function FichiersRendezVous({ fichiers, style }) {
  if (!fichiers?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, ...style }}>
      {fichiers.map((f) => <Fichier key={f.id} fichier={f} />)}
    </div>
  );
}

function Fichier({ fichier }) {
  const [enCours, setEnCours] = useState(false);
  const url = `/api/rendezvous/fichiers/${fichier.id}`;

  async function enregistrer() {
    const tactile = window.matchMedia?.("(pointer: coarse)").matches;
    if (tactile && navigator.canShare) {
      setEnCours(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const fichierPartage = new File([blob], fichier.nom, { type: blob.type });
        if (navigator.canShare({ files: [fichierPartage] })) {
          await navigator.share({ files: [fichierPartage], title: fichier.nom });
          return;
        }
      } catch (e) {
        if (e?.name === "AbortError") return; // partage annulé par l'utilisateur
      } finally {
        setEnCours(false);
      }
    }
    // Ordinateur (ou partage indisponible) : téléchargement
    const lien = document.createElement("a");
    lien.href = `${url}?telecharger=1`;
    lien.download = fichier.nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <a href={url} target="_blank" rel="noopener" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", padding: "4px 8px" }}>
        📎 {fichier.nom}
      </a>
      <button
        onClick={enregistrer}
        disabled={enCours}
        title="Enregistrer sur l'appareil ou dans le nuage"
        aria-label={`Enregistrer ${fichier.nom}`}
        style={{ fontSize: 12, background: "none", border: "none", borderLeft: "1px solid var(--border)", color: "var(--text)", padding: "4px 8px", cursor: "pointer" }}
      >
        {enCours ? "…" : "⬇️"}
      </button>
    </span>
  );
}
