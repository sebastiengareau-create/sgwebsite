"use client";

export default function BoutonImprimerRapport() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: "#e8a33d", color: "#17150f", border: "none", padding: "10px 20px",
        borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer",
      }}
    >
      🖨️ Imprimer ce rapport
    </button>
  );
}
