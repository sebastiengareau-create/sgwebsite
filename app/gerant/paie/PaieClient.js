"use client";

import Link from "next/link";

const STATUT_INFO = {
  BROUILLON: { icone: "🟡", label: "Brouillon", couleur: "#C9A227" },
  COMPTABILISEE: { icone: "⚫", label: "Comptabilisée", couleur: "var(--text-muted)" },
};

export default function PaieClient({ lots }) {
  const brouillons = lots.filter((l) => l.statut === "BROUILLON");
  const historique = lots.filter((l) => l.statut === "COMPTABILISEE");

  return (
    <div className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>🧾 Paie</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <Link href="/gerant/paie/journal" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
          📖 Journal / sommaire →
        </Link>
        <Link href="/gerant/paie/cumulatifs" target="_blank" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
          🖨️ Cumulatifs →
        </Link>
      </div>

      <div style={{ background: "#3a2620", border: "1px solid var(--danger)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 11.5, color: "#f2c4b8", lineHeight: 1.5, margin: 0 }}>
          ⚠️ <strong>Estimation seulement.</strong> Calculée avec la méthode d'annualisation (taux officiels 2026), mais
          ne remplace pas la formule complète de Revenu Québec. Valide toujours avec{" "}
          <a href="https://www.revenuquebec.ca/fr/services-en-ligne/outils/webras/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
            WebRAS
          </a>{" "}
          avant de verser une vraie paie.
        </p>
      </div>

      <Link href="/gerant/paie/nouveau" className="bouton-3d" style={{ display: "block", textAlign: "center", padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none", marginBottom: 20 }}>
        + Nouveau lot de paie
      </Link>

      {brouillons.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Brouillons à traiter</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {brouillons.map((l) => <CarteLot key={l.id} lot={l} />)}
          </div>
        </>
      )}

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Historique</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {historique.map((l) => <CarteLot key={l.id} lot={l} />)}
        {historique.length === 0 && brouillons.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun lot de paie encore.</p>
        )}
      </div>
    </div>
  );
}

function CarteLot({ lot }) {
  const info = STATUT_INFO[lot.statut];
  return (
    <Link href={`/gerant/paie/lots/${lot.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ background: "var(--surface)", border: `1px solid ${lot.statut === "BROUILLON" ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>#{lot.numero}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: info.couleur }}>{info.icone} {info.label}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
          {new Date(lot.periodeDebut).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} → {new Date(lot.periodeFin).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
          {lot.typePaie === "VACANCES" && " · 🏖️ Vacances"}
        </div>
        <div style={{ fontSize: 12.5, marginTop: 6 }}>
          {lot.nbEmployes} employé{lot.nbEmployes !== 1 ? "s" : ""} · {lot.totalBrut.toFixed(2)} $ brut · {lot.totalDeductions.toFixed(2)} $ retenues · <strong>{lot.totalNet.toFixed(2)} $ net</strong>
        </div>
      </div>
    </Link>
  );
}
