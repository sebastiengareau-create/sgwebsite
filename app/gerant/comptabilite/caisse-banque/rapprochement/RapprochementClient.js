"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RapprochementClient({ comptesTresorerie, compteId, lignes, historique }) {
  const router = useRouter();
  const [soldeReleve, setSoldeReleve] = useState("");
  const [dateReleve, setDateReleve] = useState(new Date().toISOString().slice(0, 10));
  const [enCours, setEnCours] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const soldeLivres = useMemo(() => lignes.reduce((s, l) => s + l.debit - l.credit, 0), [lignes]);
  const soldePointe = useMemo(() => lignes.filter((l) => l.rapproche).reduce((s, l) => s + l.debit - l.credit, 0), [lignes]);
  const ecart = soldeReleve !== "" ? Number(soldeReleve) - soldeLivres : null;
  const ecartPointage = soldeReleve !== "" ? Number(soldeReleve) - soldePointe : null;

  function changerCompte(id) {
    router.push(`/gerant/comptabilite/caisse-banque/rapprochement?compte=${id}`);
  }

  async function toggleLigne(id, actuel) {
    setEnCours(id);
    await fetch(`/api/comptabilite/lignes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rapproche: !actuel }),
    });
    setEnCours(null);
    router.refresh();
  }

  async function finaliser() {
    if (soldeReleve === "" || !compteId) return;
    if (!window.confirm(`Enregistrer ce rapprochement — solde des livres ${soldeLivres.toFixed(2)} $, relevé ${Number(soldeReleve).toFixed(2)} $, écart ${(Number(soldeReleve) - soldeLivres).toFixed(2)} $ ?`)) return;
    setEnregistrement(true);
    await fetch("/api/comptabilite/rapprochement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compteTresorerieId: compteId, dateRapprochement: dateReleve, soldeReleve, soldeLivres }),
    });
    setEnregistrement(false);
    setConfirmation("Rapprochement enregistré ✓");
    router.refresh();
    setTimeout(() => setConfirmation(""), 3000);
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite/caisse-banque" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Caisse & Banque</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>🏦 Conciliation</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
        Coche chaque transaction qui apparaît aussi sur ton relevé, pour confirmer que les deux concordent.
      </p>

      <select
        value={compteId || ""}
        onChange={(e) => changerCompte(e.target.value)}
        style={{ ...champStyle, marginBottom: 16, fontWeight: 700 }}
      >
        {comptesTresorerie.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: "var(--text-muted)" }}>Solde selon les livres</span>
          <span style={{ fontWeight: 700 }}>{soldeLivres.toFixed(2)} $</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 10 }}>
          <span style={{ color: "var(--text-muted)" }}>Total pointé jusqu'ici</span>
          <span style={{ fontWeight: 700 }}>{soldePointe.toFixed(2)} $</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Date du relevé</label>
            <input type="date" value={dateReleve} onChange={(e) => setDateReleve(e.target.value)} style={champStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Solde selon le relevé</label>
            <input type="number" step="0.01" value={soldeReleve} onChange={(e) => setSoldeReleve(e.target.value)} placeholder="0.00" style={champStyle} />
          </div>
        </div>

        {soldeReleve !== "" && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: Math.abs(ecart) < 0.01 ? "rgba(111,169,107,0.12)" : "rgba(193,91,74,0.12)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: Math.abs(ecart) < 0.01 ? "var(--success)" : "var(--danger)" }}>
              {Math.abs(ecart) < 0.01 ? "✓ Ça concorde parfaitement" : `Écart : ${ecart.toFixed(2)} $`}
            </div>
            {Math.abs(ecartPointage) >= 0.01 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Écart avec les lignes pointées seulement : {ecartPointage.toFixed(2)} $ — vérifie les transactions non cochées ci-dessous
              </div>
            )}
          </div>
        )}
        {confirmation && <p style={{ color: "var(--success)", fontSize: 12, marginTop: 8, fontWeight: 700 }}>{confirmation}</p>}
        <button
          onClick={finaliser} disabled={soldeReleve === "" || enregistrement}
          className="bouton-3d" style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13 }}
        >
          {enregistrement ? "Enregistrement…" : "Enregistrer ce rapprochement"}
        </button>
      </div>

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Transactions ({lignes.length})</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {lignes.map((l) => (
          <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, cursor: "pointer", opacity: enCours === l.id ? 0.6 : 1 }}>
            <input type="checkbox" checked={l.rapproche} onChange={() => toggleLigne(l.id, l.rapproche)} disabled={enCours === l.id} style={{ width: 18, height: 18, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{l.ecriture.description}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{new Date(l.ecriture.date).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} · {l.ecriture.numero}</div>
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: l.debit > 0 ? "var(--success)" : "var(--danger)" }}>
              {l.debit > 0 ? "+" : "−"}{(l.debit || l.credit).toFixed(2)} $
            </span>
          </label>
        ))}
        {lignes.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune transaction sur ce compte encore.</p>}
      </div>

      {historique.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Historique</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {historique.map((h) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                <span style={{ color: "var(--text-muted)" }}>{new Date(h.dateRapprochement).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</span>
                <span style={{ fontWeight: 700, color: Math.abs(h.ecart) < 0.01 ? "var(--success)" : "var(--danger)" }}>
                  {Math.abs(h.ecart) < 0.01 ? "✓ Concordant" : `Écart ${h.ecart.toFixed(2)} $`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const champStyle = {
  width: "100%", padding: "8px 9px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
