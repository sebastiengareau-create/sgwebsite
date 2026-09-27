"use client";

// Choix d'un véhicule du dossier du client (nouveau bon, nouveau rendez-vous)
export default function OptionVehicule({ actif, onClick, titre, detail }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        textAlign: "left", padding: "8px 10px", borderRadius: 8, cursor: "pointer", color: "var(--text)",
        background: "var(--surface)", border: `1px solid ${actif ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: actif ? 700 : 500 }}>{actif ? "● " : "○ "}{titre}</div>
      {detail && <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginLeft: 16 }}>{detail}</div>}
    </button>
  );
}
