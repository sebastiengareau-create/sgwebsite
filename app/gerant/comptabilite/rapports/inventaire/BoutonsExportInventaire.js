"use client";

import { useRouter } from "next/navigation";

const boutonStyle = {
  border: "none", padding: "10px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
  textDecoration: "none", display: "inline-block", margin: "0 4px",
};

// tris : { cle: libellé } — le tri choisi vaut pour la page, le PDF et l'Excel
export default function BoutonsExportInventaire({ tri, tris }) {
  const router = useRouter();
  return (
    <div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 12, color: "#17150f" }}>
        Trier par
        <select value={tri} onChange={(e) => router.replace(`?tri=${e.target.value}`)} style={{ padding: "6px 8px", borderRadius: 6, fontSize: 13 }}>
          {Object.entries(tris).map(([cle, libelle]) => <option key={cle} value={cle}>{libelle}</option>)}
        </select>
      </label>
      <div>
        <button onClick={() => window.print()} style={{ ...boutonStyle, background: "#e8a33d", color: "#17150f" }}>
          🖨️ Imprimer
        </button>
        <a href={`/api/inventaire/rapport/pdf?tri=${tri}`} style={{ ...boutonStyle, background: "#17150f", color: "white" }}>
          📄 Télécharger en PDF
        </a>
        <a href={`/api/inventaire/rapport/csv?tri=${tri}`} style={{ ...boutonStyle, background: "#17150f", color: "white" }}>
          📊 Télécharger en Excel (.csv)
        </a>
      </div>
    </div>
  );
}
