"use client";

const boutonStyle = {
  border: "none", padding: "10px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
  textDecoration: "none", display: "inline-block", margin: "0 4px",
};

export default function BoutonsExportListe({ hrefPdf, hrefCsv }) {
  return (
    <div>
      <button onClick={() => window.print()} style={{ ...boutonStyle, background: "#e8a33d", color: "#17150f" }}>
        🖨️ Imprimer
      </button>
      <a href={hrefPdf} style={{ ...boutonStyle, background: "#17150f", color: "white" }}>
        📄 Télécharger en PDF
      </a>
      <a href={hrefCsv} style={{ ...boutonStyle, background: "#17150f", color: "white" }}>
        📊 Télécharger en Excel (.csv)
      </a>
    </div>
  );
}
