"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { compresserImage } from "@/lib/images";
import { useChoixPhoto } from "@/app/components/ChoixPhoto";

// Bouton photo d'une tâche, directement dans l'horodateur : le mécanicien
// documente son travail sans ouvrir la fiche du bon. Les photos rejoignent
// celles de la tâche sur le bon (même route que la fiche).
export default function TachePhoto({ bonId, problemeId, nbPhotos }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  // Plusieurs photos choisies d'un coup : envoyées une à une, arrêt à la
  // première refusée (les précédentes restent sur la tâche).
  async function envoyer(fichiers) {
    setErreur("");
    setEnvoi(true);
    try {
      for (const file of fichiers) {
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
      }
    } catch (e) {
      setErreur("Impossible de traiter cette photo : " + e.message);
    } finally {
      setEnvoi(false);
      router.refresh();
    }
  }
  const photo = useChoixPhoto(envoyer, { multiple: true });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <button
        type="button"
        disabled={envoi}
        onClick={photo.ouvrir}
        style={{
          padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)", fontSize: 11, fontWeight: 700,
          cursor: "pointer", background: "var(--surface)", color: "var(--text)",
        }}
      >
        {envoi ? "Envoi…" : `📷 Photo${nbPhotos > 0 ? ` (${nbPhotos})` : ""}`}
      </button>
      {photo.element}
      {erreur && <div style={{ color: "var(--danger)", fontSize: 10.5, marginTop: 4, maxWidth: 220, textAlign: "right" }}>{erreur}</div>}
    </div>
  );
}
