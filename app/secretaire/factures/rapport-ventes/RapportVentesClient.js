"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GROUPEMENTS = [
  { valeur: "jour", label: "Jour" },
  { valeur: "semaine", label: "Semaine" },
  { valeur: "mois", label: "Mois" },
];

function fmt(montant) {
  return `${montant.toFixed(2)} $`;
}

export default function RapportVentesClient({ lignes, totaux, ticketMoyen, debutStr, finStr, groupement, nombreAnnulees }) {
  const router = useRouter();
  const [debut, setDebut] = useState(debutStr);
  const [fin, setFin] = useState(finStr);
  const [grp, setGrp] = useState(groupement);

  function appliquerFiltre(e) {
    e.preventDefault();
    router.push(`/secretaire/factures/rapport-ventes?debut=${debut}&fin=${fin}&groupement=${grp}`);
  }

  const requete = `debut=${debutStr}&fin=${finStr}&groupement=${groupement}`;

  return (
    <div className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>📊 Rapport de ventes</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Chiffre d'affaires facturé, groupé par {groupement}.
        {nombreAnnulees > 0 && ` ${nombreAnnulees} facture${nombreAnnulees !== 1 ? "s" : ""} annulée${nombreAnnulees !== 1 ? "s" : ""} exclue${nombreAnnulees !== 1 ? "s" : ""}.`}
      </p>

      <form onSubmit={appliquerFiltre} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} style={champStyle} />
        <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} style={champStyle} />
        <select value={grp} onChange={(e) => setGrp(e.target.value)} style={champStyle}>
          {GROUPEMENTS.map((g) => (
            <option key={g.valeur} value={g.valeur}>{g.label}</option>
          ))}
        </select>
        <button type="submit" className="bouton-3d-sombre" style={{ padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          Filtrer
        </button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <Carte valeur={fmt(totaux.totalAvantTaxes)} label="Ventes (avant taxes)" couleur="var(--accent)" />
        <Carte valeur={fmt(totaux.tps + totaux.tvq)} label="Taxes perçues" couleur="var(--text-muted)" />
        <Carte valeur={fmt(totaux.totalAvecTaxes)} label="Total avec taxes" couleur="#6FA96B" />
        <Carte
          valeur={String(totaux.nombreFactures)}
          label={`Facture${totaux.nombreFactures !== 1 ? "s" : ""} — ticket moyen ${fmt(ticketMoyen)}`}
          couleur="var(--text)"
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => window.print()} className="bouton-3d-sombre" style={boutonExportStyle}>🖨️ Imprimer</button>
        <a href={`/api/factures/rapport-ventes/pdf?${requete}`} className="bouton-3d-sombre" style={{ ...boutonExportStyle, textDecoration: "none", display: "inline-block" }}>
          📄 PDF
        </a>
        <a href={`/api/factures/rapport-ventes/csv?${requete}`} className="bouton-3d-sombre" style={{ ...boutonExportStyle, textDecoration: "none", display: "inline-block" }}>
          📊 Excel (.csv)
        </a>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={enteteStyle}>Période</th>
              <th style={{ ...enteteStyle, textAlign: "right" }}>#</th>
              <th style={{ ...enteteStyle, textAlign: "right" }}>Pièces</th>
              <th style={{ ...enteteStyle, textAlign: "right" }}>Main-d'œuvre</th>
              <th style={{ ...enteteStyle, textAlign: "right" }}>Avant taxes</th>
              <th style={{ ...enteteStyle, textAlign: "right" }}>Taxes</th>
              <th style={{ ...enteteStyle, textAlign: "right" }}>Avec taxes</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.cle} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={celluleStyle}>{l.libelle}</td>
                <td style={{ ...celluleStyle, textAlign: "right" }}>{l.nombreFactures}</td>
                <td style={{ ...celluleStyle, textAlign: "right" }}>{fmt(l.totalPieces)}</td>
                <td style={{ ...celluleStyle, textAlign: "right" }}>{fmt(l.totalMainOeuvre)}</td>
                <td style={{ ...celluleStyle, textAlign: "right", fontWeight: 600 }}>{fmt(l.totalAvantTaxes)}</td>
                <td style={{ ...celluleStyle, textAlign: "right" }}>{fmt(l.tps + l.tvq)}</td>
                <td style={{ ...celluleStyle, textAlign: "right", fontWeight: 700 }}>{fmt(l.totalAvecTaxes)}</td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "16px 4px", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center" }}>
                  Aucune vente sur cette période.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Carte({ valeur, label, couleur }) {
  return (
    <div className="carte carte-s">
      <div style={{ fontSize: 18, fontWeight: 700, color: couleur }}>{valeur}</div>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

const champStyle = {
  flex: "1 1 130px", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 13,
};

const boutonExportStyle = { border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" };

const enteteStyle = { textAlign: "left", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)" };
const celluleStyle = { padding: "8px 4px" };
