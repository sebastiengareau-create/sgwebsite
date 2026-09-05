"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JournalClient({ ecritures }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(null);

  async function supprimerUne(id) {
    if (!window.confirm("Supprimer cette écriture ? Cette action est irréversible.")) return;
    setEnCours(id);
    const res = await fetch(`/api/comptabilite/ecritures/${id}`, { method: "DELETE" });
    setEnCours(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.refresh();
  }

  async function toutReinitialiser() {
    if (!window.confirm(`Supprimer les ${ecritures.length} écriture(s) ? À utiliser seulement en période de test — irréversible.`)) return;
    if (!window.confirm("Vraiment sûr ? Toute la comptabilité repart à zéro.")) return;
    setEnCours("tout");
    const res = await fetch("/api/comptabilite/ecritures", { method: "DELETE" });
    setEnCours(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur lors de la réinitialisation.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au plan comptable</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>Journal général</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>{ecritures.length} écriture(s) — automatiques (factures, paie, dépenses…) et manuelles.</p>

      <Link
        href="/gerant/comptabilite/ecriture-manuelle"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", marginBottom: 16, padding: 12, borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700 }}
      >
        ✍️ Nouvelle écriture supplémentaire
      </Link>

      {ecritures.length > 0 && (
        <button
          onClick={toutReinitialiser}
          disabled={enCours === "tout"}
          style={{ width: "100%", marginBottom: 16, padding: 10, borderRadius: 8, border: "1px dashed var(--danger)", background: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer" }}
        >
          🗑️ Tout réinitialiser (période de test)
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ecritures.map((e) => (
          <div key={e.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--text-muted)" }}>
              <span style={{ fontFamily: "monospace" }}>{e.numero}{e.reference ? ` · ${e.reference}` : ""}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: e.source === "MANUEL" ? "var(--accent)" : "var(--text-muted)" }}>
                  {e.source === "MANUEL" ? "✍️ Manuelle" : "🤖 Auto"}
                </span>
                {new Date(e.date).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, marginBottom: 2 }}>{e.description}</div>
            {e.creePar && <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>par {e.creePar}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {e.lignes.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>{l.compte.numero} — {l.compte.nom}</span>
                  <span>{l.debit > 0 ? `${l.debit.toFixed(2)} $ (débit)` : `${l.credit.toFixed(2)} $ (crédit)`}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => supprimerUne(e.id)}
              disabled={enCours === e.id}
              style={{ marginTop: 8, fontSize: 11, color: "var(--danger)", background: "none", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 8, cursor: "pointer" }}
            >
              🗑️ Supprimer
            </button>
          </div>
        ))}
        {ecritures.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune écriture encore.</p>}
      </div>
    </div>
  );
}
