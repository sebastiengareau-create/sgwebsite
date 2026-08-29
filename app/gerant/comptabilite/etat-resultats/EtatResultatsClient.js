"use client";

import Link from "next/link";

const COULEURS_REVENU = ["#E8A33D", "#4F82C0", "#6FA96B", "#C9A227", "#9C6ADE", "#5AC8C8", "#D46A8F"];
const COULEURS_DEPENSE = ["#C15B4A", "#B8791F", "#8A6D5C"];

export default function EtatResultatsClient({ lignes }) {
  const revenus = lignes.filter((l) => l.type === "REVENU" && l.solde !== 0).sort((a, b) => b.solde - a.solde);
  const depenses = lignes.filter((l) => l.type === "DEPENSE" && l.solde !== 0).sort((a, b) => b.solde - a.solde);

  const totalRevenus = revenus.reduce((s, l) => s + l.solde, 0);
  const totalDepenses = depenses.reduce((s, l) => s + l.solde, 0);
  const profitNet = totalRevenus - totalDepenses;
  const margeNette = totalRevenus > 0 ? (profitNet / totalRevenus) * 100 : 0;

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au plan comptable</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>État des résultats</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Depuis le début — généré automatiquement à partir de tes factures.</p>

      {/* Profit net — mis en évidence en premier */}
      <div className="bouton-3d" style={{ padding: 20, borderRadius: 14, marginBottom: 24, textAlign: "center" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, opacity: 0.75, marginBottom: 4 }}>Profit net</div>
        <div style={{ fontSize: 32, fontWeight: 800 }}>{profitNet.toFixed(2)} $</div>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginTop: 2 }}>Marge de {margeNette.toFixed(1)}%</div>
      </div>

      {/* Revenus */}
      <SectionBarres titre="💰 Revenus" total={totalRevenus} lignes={revenus} couleurs={COULEURS_REVENU} />

      {/* Dépenses */}
      <SectionBarres titre="📉 Dépenses" total={totalDepenses} lignes={depenses} couleurs={COULEURS_DEPENSE} />

      {revenus.length === 0 && depenses.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginTop: 30 }}>
          Aucune donnée encore — émets ta première facture pour voir apparaître les chiffres ici.
        </p>
      )}
    </div>
  );
}

function SectionBarres({ titre, total, lignes, couleurs }) {
  if (lignes.length === 0) return null;
  const max = Math.max(...lignes.map((l) => l.solde), 1);

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{titre}</span>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{total.toFixed(2)} $</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lignes.map((l, i) => {
          const couleur = couleurs[i % couleurs.length];
          const largeur = Math.max(6, (l.solde / max) * 100);
          const part = total > 0 ? (l.solde / total) * 100 : 0;
          return (
            <div key={l.numero}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                <span>{l.nom}</span>
                <span style={{ fontWeight: 700 }}>{l.solde.toFixed(2)} $ <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({part.toFixed(0)}%)</span></span>
              </div>
              <div style={{ height: 10, background: "var(--surface)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{ width: `${largeur}%`, height: "100%", background: couleur, borderRadius: 999 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
