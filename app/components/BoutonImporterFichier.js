"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

// Bouton "Importer depuis Excel" générique — upload un .xlsx/.xls/.csv vers
// `apiUrl`, puis affiche le résumé { importes, doublons, ignores } (ou une
// erreur) retourné par la route. `libellePluriel` nomme les entités
// importées (ex. "client", "pièce") pour le message de succès.
export default function BoutonImporterFichier({ apiUrl, libelle, libellePluriel }) {
  const router = useRouter();
  const fichierRef = useRef(null);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);

  async function importerFichier(e) {
    const fichier = e.target.files[0];
    if (!fichier) return;
    setEnCours(true);
    setResultat(null);
    const donnees = new FormData();
    donnees.append("fichier", fichier);
    const res = await fetch(apiUrl, { method: "POST", body: donnees });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    e.target.value = "";
    if (!res.ok) {
      setResultat({ erreur: data.erreur || "Erreur lors de l'import." });
      return;
    }
    setResultat(data);
    router.refresh();
  }

  return (
    <>
      <input ref={fichierRef} type="file" accept=".xlsx,.xls,.csv" onChange={importerFichier} style={{ display: "none" }} />
      <button
        onClick={() => fichierRef.current?.click()}
        disabled={enCours}
        className="bouton-3d-sombre"
        style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}
      >
        {enCours ? "Import…" : `📥 Importer ${libelle || "depuis Excel"}`}
      </button>

      {resultat && (
        <div style={{
          background: resultat.erreur ? "rgba(193,91,74,0.12)" : "rgba(111,169,107,0.12)",
          border: `1px solid ${resultat.erreur ? "var(--danger)" : "var(--success)"}`,
          borderRadius: 10, padding: 12, marginTop: 12, fontSize: 12.5, width: "100%",
        }}>
          {resultat.erreur ? (
            <p style={{ margin: 0 }}>⚠️ {resultat.erreur}</p>
          ) : (
            <>
              <p style={{ margin: 0, fontWeight: 700 }}>
                ✅ {resultat.importes} {libellePluriel || "élément"}{resultat.importes !== 1 ? "s" : ""} importé{resultat.importes !== 1 ? "s" : ""}
              </p>
              {resultat.doublons.length > 0 && (
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)" }}>
                  {resultat.doublons.length} ignoré{resultat.doublons.length !== 1 ? "s" : ""} (déjà existant{resultat.doublons.length !== 1 ? "s" : ""}) : {resultat.doublons.join(", ")}
                </p>
              )}
              {resultat.ignores.length > 0 && (
                <p style={{ margin: "4px 0 0", color: "var(--danger)" }}>
                  {resultat.ignores.join(" · ")}
                </p>
              )}
            </>
          )}
          <button onClick={() => setResultat(null)} style={{ marginTop: 6, background: "none", border: "none", color: "var(--accent)", fontSize: 11.5, cursor: "pointer", padding: 0 }}>
            Fermer
          </button>
        </div>
      )}
    </>
  );
}
