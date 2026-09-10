"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function TransfertsClient({ comptesTresorerie, transferts }) {
  const router = useRouter();
  const [compteSourceId, setCompteSourceId] = useState(comptesTresorerie[0]?.id || "");
  const [compteDestinationId, setCompteDestinationId] = useState(comptesTresorerie[1]?.id || comptesTresorerie[0]?.id || "");
  const [montant, setMontant] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function effectuer(e) {
    e.preventDefault();
    setErreur("");
    if (compteSourceId === compteDestinationId) { setErreur("Choisis deux comptes différents."); return; }
    if (!montant || Number(montant) <= 0) { setErreur("Montant invalide."); return; }
    setEnCours(true);
    const res = await fetch("/api/comptabilite/tresorerie/transferts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compteSourceId, compteDestinationId, montant, description, date }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setMontant(""); setDescription("");
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite/caisse-banque" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Caisse & Banque</Link>
      <h1 style={{ fontSize: 20, margin: "8px 0 12px" }}>🔁 Transferts entre comptes</h1>

      {comptesTresorerie.length < 2 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Il faut au moins 2 comptes actifs pour faire un transfert.</p>
      ) : (
        <form onSubmit={effectuer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <label style={labelStyle}>De</label>
          <select value={compteSourceId} onChange={(e) => setCompteSourceId(e.target.value)} style={champStyle}>
            {comptesTresorerie.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>

          <label style={labelStyle}>Vers</label>
          <select value={compteDestinationId} onChange={(e) => setCompteDestinationId(e.target.value)} style={champStyle}>
            {comptesTresorerie.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Montant ($)</label>
              <input type="number" min={0} step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} style={champStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={champStyle} />
            </div>
          </div>

          <label style={labelStyle}>Description (optionnel)</label>
          <input placeholder="Ex : Dépôt de la caisse à la banque" value={description} onChange={(e) => setDescription(e.target.value)} style={champStyle} />

          {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5 }}>{erreur}</p>}
          <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            {enCours ? "…" : "🔁 Transférer"}
          </button>
        </form>
      )}

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Transferts récents</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {transferts.map((t) => (
          <div key={t.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t.compteSourceNom} → {t.compteDestinationNom}</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{t.montant.toFixed(2)} $</span>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              {new Date(t.date).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} · {t.numero} · {t.description}
            </div>
          </div>
        ))}
        {transferts.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun transfert encore.</p>}
      </div>
    </div>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 };
