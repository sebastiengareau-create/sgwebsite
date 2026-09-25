"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TitreSection } from "../../../components/ui";
import ChampsVehicule, { VEHICULE_VIDE } from "../../../components/ChampsVehicule";
import { libelleVehicule } from "@/lib/vehicules";

// Dossier véhicule sur la fiche client : tous les véhicules du client, avec
// ajout, modification et suppression (bloquée si le véhicule figure sur un bon).
export default function DossierVehicules({ clientId, vehicules }) {
  const router = useRouter();
  const [edition, setEdition] = useState(null); // null | "nouveau" | id du véhicule
  const [valeur, setValeur] = useState(VEHICULE_VIDE);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  function ouvrir(v) {
    setErreur("");
    setEdition(v ? v.id : "nouveau");
    setValeur(v
      ? { annee: v.annee ? String(v.annee) : "", marque: v.marque || "", modele: v.modele || "", version: v.version || "", niv: v.niv || "", plaque: v.plaque || "" }
      : VEHICULE_VIDE);
  }

  async function sauvegarder(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch(edition === "nouveau" ? `/api/clients/${clientId}/vehicules` : `/api/vehicules/${edition}`, {
      method: edition === "nouveau" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valeur),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setEdition(null);
    router.refresh();
  }

  async function supprimer(v) {
    if (!window.confirm(`Retirer « ${libelleVehicule(v) || "ce véhicule"} » du dossier ?`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/vehicules/${v.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="carte" style={{ marginBottom: 12 }}>
      <TitreSection>🚗 Véhicules ({vehicules.length})</TitreSection>

      {vehicules.length === 0 && edition === null && (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun véhicule au dossier.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {vehicules.map((v) =>
          edition === v.id ? null : (
            <div key={v.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{libelleVehicule(v) || "Véhicule sans description"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", overflowWrap: "anywhere" }}>
                  {[v.plaque && `Plaque ${v.plaque}`, v.niv && `NIV ${v.niv}`].filter(Boolean).join(" · ") || "Aucune plaque ni NIV"}
                  {v._count?.bons > 0 && <span style={{ fontFamily: "inherit" }}> · {v._count.bons} bon{v._count.bons > 1 ? "s" : ""}</span>}
                </div>
              </div>
              <button type="button" onClick={() => ouvrir(v)} disabled={enCours} style={boutonIcone} title="Modifier">✏️</button>
              <button type="button" onClick={() => supprimer(v)} disabled={enCours} style={boutonIcone} title="Retirer du dossier">🗑️</button>
            </div>
          )
        )}
      </div>

      {edition !== null ? (
        <form onSubmit={sauvegarder} style={{ marginTop: 10, borderTop: vehicules.length ? "1px solid var(--border)" : "none", paddingTop: vehicules.length ? 6 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{edition === "nouveau" ? "Nouveau véhicule" : "Modifier le véhicule"}</div>
          <ChampsVehicule valeur={valeur} onChange={setValeur} />
          {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erreur}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="submit" disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 10, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <button type="button" onClick={() => setEdition(null)} className="bouton-3d-sombre" style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13 }}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <>
          {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erreur}</p>}
          <button type="button" onClick={() => ouvrir(null)} style={boutonAjout}>+ Ajouter un véhicule</button>
        </>
      )}
    </div>
  );
}

const boutonIcone = { background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 4 };
const boutonAjout = {
  background: "none", border: "1px dashed var(--border)", color: "var(--accent)", fontSize: 12,
  padding: "6px 10px", borderRadius: 8, cursor: "pointer", width: "100%", marginTop: 8,
};
