"use client";

import { cleEmplacement } from "@/lib/pneusCalculs";

// Emplacement à l'entrepôt : le champ, et les premières places libres du
// plan à toucher (Réglages → Plan de l'entrepôt). occupes : emplacements des
// autres jeux à l'entrepôt (sans celui qui se libère), pour avertir d'une
// place déjà prise — le serveur la refuse aussi. libere : la place qui se
// libère (changement de saison), proposée en premier.
export default function ChoixEmplacement({ valeur, onChange, libres = [], occupes = [], libere = null, libelle = "Emplacement à l'entrepôt", autoFocus = false }) {
  const cle = cleEmplacement(valeur);
  const pris = !!cle && occupes.some((o) => cleEmplacement(o) === cle);
  const choix = [...new Set([libere, ...libres].filter(Boolean))].slice(0, 7);
  return (
    <div style={{ minWidth: 0 }}>
      <label style={{ display: "block" }}>
        <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
          {libelle}{libere && cle === cleEmplacement(libere) ? " (place libérée)" : ""}
        </span>
        <input
          value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={choix[0] || "A-12"} className="champ" autoFocus={autoFocus}
          style={{ fontSize: 15, textTransform: "uppercase", maxWidth: 200, ...(pris && { borderColor: "var(--danger)" }) }}
          aria-invalid={pris || undefined}
        />
      </label>
      {pris && <div role="alert" style={{ fontSize: 12, color: "var(--danger)", marginTop: 4 }}>Cette place est déjà prise par un autre jeu.</div>}
      {choix.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{libere ? "Places :" : "Libres :"}</span>
          {choix.map((nom) => {
            const actif = cleEmplacement(nom) === cle;
            return (
              <button
                key={nom} type="button" onClick={() => onChange(nom)} aria-pressed={actif}
                style={{
                  fontSize: 12.5, fontWeight: 800, padding: "4px 9px", borderRadius: 8, cursor: "pointer", fontVariantNumeric: "tabular-nums",
                  border: `1px solid ${actif ? "var(--accent)" : "var(--border)"}`, background: actif ? "rgba(232,163,61,0.14)" : "var(--surface)", color: "var(--text)",
                }}
              >
                {nom}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
