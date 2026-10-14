"use client";

import { regrouperParMois } from "@/lib/regroupementDates";

// Un dossier repliable par mois (du plus récent au plus ancien) — pour les
// bons facturés et les factures des mois précédents, le mois en cours restant
// affiché un par un. `ouvert` (recherche en cours) ouvre tout pour montrer
// les résultats. `resume(elements)` ajoute un texte au titre (ex. un total).
export default function DossiersParMois({ elements, obtenirDate, carte, ouvert, compact, couleur = "#6FA96B", resume }) {
  return regrouperParMois(elements, obtenirDate).map((m) => (
    <details key={`${m.cle}-${!!ouvert}`} open={!!ouvert} className="dossier-mois" style={{ marginTop: compact ? 2 : 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: compact ? "6px 8px" : "8px 10px" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6, userSelect: "none", fontSize: compact ? 12 : 13, fontWeight: 700 }}>
        <span className="chevron-dossier" style={{ color: "var(--text-muted)", fontSize: 10 }}>▶</span>
        📁 {m.libelle}
        {resume && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>· {resume(m.elements)}</span>}
        <span style={{ marginLeft: "auto", fontSize: 11, color: couleur, background: `${couleur}22`, borderRadius: 999, padding: "1px 8px" }}>{m.elements.length}</span>
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 8, marginTop: 8 }}>
        {m.elements.map(carte)}
      </div>
    </details>
  ));
}
