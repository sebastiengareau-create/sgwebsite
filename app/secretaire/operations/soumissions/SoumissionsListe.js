"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BoutonFlottantNouveau from "../../../components/BoutonFlottantNouveau";

const STATUTS = {
  EN_ATTENTE: { label: "En attente", color: "#C9A227" },
  ACCEPTEE: { label: "Acceptée", color: "#6FA96B" },
};
// Anciennes valeurs possibles sur des soumissions créées avant ce changement
const LIBELLE_STATUT = (s) => STATUTS[s]?.label || (s === "BROUILLON" || s === "ENVOYEE" ? "En attente" : s === "REFUSEE" ? "Refusée" : s);
const COULEUR_STATUT = (s) => STATUTS[s]?.color || (s === "REFUSEE" ? "#C15B4A" : "#9C978A");

export default function SoumissionsListe({ soumissions, tauxHoraireClient }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [enCoursId, setEnCoursId] = useState(null);
  const [erreurId, setErreurId] = useState(null);

  const filtrees = soumissions.filter((s) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return s.clientNom.toLowerCase().includes(q) || s.numero.toLowerCase().includes(q);
  });

  async function accepter(s) {
    if (!window.confirm(`Accepter la soumission #${s.numero} ? Ça va créer un vrai bon de commande avec ces tâches.`)) return;
    setErreurId(null);
    setEnCoursId(s.id);
    const res = await fetch(`/api/soumissions/${s.id}/accepter`, { method: "POST" });
    setEnCoursId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreurId({ id: s.id, message: data.erreur || "Erreur." });
      return;
    }
    const { bonId } = await res.json();
    router.push(`/bons/${bonId}`);
  }

  async function supprimer(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Supprimer cette soumission ?")) return;
    await fetch(`/api/soumissions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>Estimés à donner avant de commencer les travaux.</p>

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher par client ou numéro…"
        style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, marginBottom: 16, boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtrees.map((s) => {
          const totalTemps = s.taches.reduce((sum, t) => sum + t.tempsEstime, 0);
          const totalPieces = s.taches.reduce((sum, t) => sum + t.pieces.reduce((s2, p) => s2 + p.prixEstime * p.qte, 0), 0);
          const totalEstime = totalTemps * tauxHoraireClient + totalPieces;
          const dejaTransformee = !!s.bonId;

          return (
            <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `3px solid ${COULEUR_STATUT(s.statut)}` }}>
              <Link href={`/secretaire/operations/soumissions/${s.id}/modifier`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>#{s.numero}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: COULEUR_STATUT(s.statut) }}>{LIBELLE_STATUT(s.statut)}</span>
                </div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{s.clientNom}</div>
                {s.vehiculeInfo && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.vehiculeInfo}</div>}
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {s.taches.length} tâche(s) · {totalTemps}h
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>
                  {totalEstime.toFixed(2)} $ estimé
                </div>
              </Link>

              {dejaTransformee ? (
                <Link href={`/bons/${s.bonId}`} style={{ display: "inline-block", marginTop: 10, fontSize: 11, fontWeight: 700, color: "var(--success)", textDecoration: "none" }}>
                  ✓ Transformée en bon de commande →
                </Link>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => accepter(s)}
                    disabled={enCoursId === s.id}
                    style={{ fontSize: 11, fontWeight: 700, color: "#17150f", background: "var(--success)", border: "none", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}
                  >
                    ✓ Accepter → créer le bon
                  </button>
                  <Link href={`/secretaire/operations/soumissions/${s.id}/imprimer`} target="_blank" style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", textDecoration: "none", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: 8 }}>
                    🖨️
                  </Link>
                  <button onClick={(e) => supprimer(s.id, e)} style={{ fontSize: 11, fontWeight: 600, color: "var(--danger)", background: "none", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>
                    🗑️
                  </button>
                </div>
              )}
              {erreurId?.id === s.id && <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{erreurId.message}</p>}
            </div>
          );
        })}
        {filtrees.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 12 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>📝</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>Pas encore de soumission.</p>
            <Link href="/secretaire/operations/soumissions/nouvelle" className="bouton-3d" style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "9px 16px", borderRadius: 999, textDecoration: "none" }}>
              + Créer la première
            </Link>
          </div>
        )}
      </div>
      <BoutonFlottantNouveau />
    </div>
  );
}
