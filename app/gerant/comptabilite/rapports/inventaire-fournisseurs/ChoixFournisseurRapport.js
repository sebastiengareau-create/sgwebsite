"use client";

import { useRouter } from "next/navigation";

const boutonStyle = {
  border: "none", padding: "10px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
  textDecoration: "none", display: "inline-block", margin: "4px",
};

// Choix du fournisseur (ou tous) et exports du rapport d'inventaire par
// fournisseur.
export default function ChoixFournisseurRapport({ fournisseurs, fournisseurId }) {
  const router = useRouter();
  const parametre = fournisseurId ? `?fournisseur=${fournisseurId}` : "";

  return (
    <div>
      <select
        value={fournisseurId}
        onChange={(e) => router.push(`/gerant/comptabilite/rapports/inventaire-fournisseurs${e.target.value ? `?fournisseur=${e.target.value}` : ""}`)}
        style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13, marginRight: 4, maxWidth: "100%" }}
      >
        <option value="">Tous les fournisseurs</option>
        {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}{f.actif ? "" : " (inactif)"}</option>)}
      </select>
      <button onClick={() => window.print()} style={{ ...boutonStyle, background: "#e8a33d", color: "#17150f" }}>🖨️ Imprimer</button>
      <a href={`/api/inventaire/rapport-fournisseurs/pdf${parametre}`} style={{ ...boutonStyle, background: "#17150f", color: "white" }}>📄 PDF</a>
      <a href={`/api/inventaire/rapport-fournisseurs/csv${parametre}`} style={{ ...boutonStyle, background: "#17150f", color: "white" }}>📊 Excel (.csv)</a>
    </div>
  );
}
