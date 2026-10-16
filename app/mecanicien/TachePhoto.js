"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { compresserImage } from "@/lib/images";

// Bouton photo d'une tâche, directement dans l'horodateur : le mécanicien
// documente son travail sans ouvrir la fiche du bon. Les photos rejoignent
// celles de la tâche sur le bon (même route que la fiche).
export default function TachePhoto({ bonId, problemeId, nbPhotos }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function envoyer(file) {
    setErreur("");
    setEnvoi(true);
    try {
      const dataUrl = await compresserImage(file);
      const res = await fetch(`/api/bons/${bonId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemeId, dataUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErreur(data.erreur || `Le serveur a refusé la photo (code ${res.status}).`);
        return;
      }
      router.refresh();
    } catch (e) {
      setErreur("Impossible de traiter cette photo : " + e.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <button
        type="button"
        disabled={envoi}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)", fontSize: 11, fontWeight: 700,
          cursor: "pointer", background: "var(--surface)", color: "var(--text)",
        }}
      >
        {envoi ? "Envoi…" : `📷 Photo${nbPhotos > 0 ? ` (${nbPhotos})` : ""}`}
      </button>
      <input
        ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) envoyer(f); e.target.value = ""; }}
      />
      {erreur && <div style={{ color: "var(--danger)", fontSize: 10.5, marginTop: 4, maxWidth: 220, textAlign: "right" }}>{erreur}</div>}
    </div>
  );
}
