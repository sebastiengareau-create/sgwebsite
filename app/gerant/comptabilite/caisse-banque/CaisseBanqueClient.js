"use client";

import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";

const LABELS_CATEGORIE = { CAISSE: "Caisse", BANQUE: "Banque", CARTE_CREDIT: "Carte de crédit" };

export default function CaisseBanqueClient({ comptes, resume, entreesMois, sortiesMois, serie30Jours }) {
  return (
    <div className="conteneur-page">
      <BandeauSection icone="💰" titre="Caisse & Banque" sousTitre="Centre de contrôle des liquidités">
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <Link href="/gerant/comptabilite/caisse-banque/comptes" style={lienBandeau}>🏦 Comptes</Link>
          <Link href="/gerant/comptabilite/caisse-banque/transactions" style={lienBandeau}>📋 Transactions</Link>
          <Link href="/gerant/comptabilite/caisse-banque/transferts" style={lienBandeau}>🔁 Transferts</Link>
          <Link href="/gerant/comptabilite/caisse-banque/rapprochement" style={lienBandeau}>✅ Conciliation</Link>
          <Link href="/gerant/comptabilite/caisse-banque/previsions" style={lienBandeau}>📊 Prévisions</Link>
        </div>
      </BandeauSection>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Carte icone="💵" label="Solde caisse" valeur={resume.caisse} />
        <Carte icone="🏦" label="Solde bancaire" valeur={resume.banque} />
        <Carte icone="💳" label="Cartes de crédit" valeur={resume.cartesCredit} couleur="var(--danger)" />
        <Carte icone="📊" label="Liquidités disponibles" valeur={resume.liquidites} accent />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <Carte icone="📥" label="Entrées du mois" valeur={entreesMois} couleur="var(--success)" />
        <Carte icone="📤" label="Sorties du mois" valeur={sortiesMois} couleur="var(--danger)" />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Entrées vs sorties — 30 derniers jours</div>
        <GraphiqueEntreesSorties serie={serie30Jours} />
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
          <span><span style={{ color: "var(--success)" }}>●</span> Entrées</span>
          <span><span style={{ color: "var(--danger)" }}>●</span> Sorties</span>
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Comptes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {comptes.map((c) => (
          <div key={c.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nom}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{LABELS_CATEGORIE[c.categorie]} · {c.compteNumero}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{c.soldeComptable.toFixed(2)} $</div>
          </div>
        ))}
        {comptes.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun compte de trésorerie encore.</p>}
      </div>

      <Link href="/gerant/comptabilite/caisse-banque/comptes" className="bouton-3d" style={{ display: "block", textAlign: "center", padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
        🏦 Gérer les comptes
      </Link>
    </div>
  );
}

function Carte({ icone, label, valeur, couleur, accent }) {
  return (
    <div style={{
      background: accent ? "var(--accent)" : "var(--surface)",
      border: "1px solid var(--border)", borderRadius: 12, padding: 14,
    }}>
      <div style={{ fontSize: 11, color: accent ? "#17150f" : "var(--text-muted)", marginBottom: 4 }}>{icone} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ? "#17150f" : (couleur || "var(--text)") }}>{valeur.toFixed(2)} $</div>
    </div>
  );
}

function GraphiqueEntreesSorties({ serie }) {
  if (!serie || serie.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Pas encore de données à afficher.</p>;
  }

  const largeur = 700;
  const hauteur = 140;
  const marge = 6;
  const max = Math.max(1, ...serie.map((j) => Math.max(j.entrees, j.sorties)));
  const pas = serie.length > 1 ? (largeur - marge * 2) / (serie.length - 1) : 0;

  const pointsPour = (cle) =>
    serie.map((j, i) => {
      const x = marge + i * pas;
      const y = hauteur - marge - ((j[cle] || 0) / max) * (hauteur - marge * 2);
      return `${x},${y}`;
    }).join(" ");

  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} style={{ width: "100%", height: 140, display: "block" }}>
      <line x1={marge} y1={hauteur - marge} x2={largeur - marge} y2={hauteur - marge} stroke="var(--border)" strokeWidth="1" />
      <polyline points={pointsPour("entrees")} fill="none" stroke="var(--success)" strokeWidth="2" />
      <polyline points={pointsPour("sorties")} fill="none" stroke="var(--danger)" strokeWidth="2" />
    </svg>
  );
}

const lienBandeau = {
  display: "inline-block", fontSize: 12, fontWeight: 600, color: "#fff", textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.3)", padding: "6px 12px", borderRadius: 8,
};
