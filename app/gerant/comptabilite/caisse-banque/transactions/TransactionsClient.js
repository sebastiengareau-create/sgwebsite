"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const PERIODES = [
  { valeur: "AUJOURDHUI", label: "Aujourd'hui" },
  { valeur: "7J", label: "7 jours" },
  { valeur: "MOIS", label: "Ce mois" },
  { valeur: "PERSONNALISE", label: "Personnalisé" },
];

const TYPES = [
  { valeur: "TOUS", label: "Tous" },
  { valeur: "ENCAISSEMENT", label: "Encaissements" },
  { valeur: "DECAISSEMENT", label: "Décaissements" },
  { valeur: "TRANSFERT", label: "Transferts" },
  { valeur: "AUTRE", label: "Autres" },
];

const SOURCES_ENCAISSEMENT = ["FACTURE_PAYEE"];
const SOURCES_DECAISSEMENT = ["DEPENSE_PAYEE", "PAIE", "IMMOBILISATION_ACQUISE", "REMISE_GOUVERNEMENTALE"];

function typeDeSource(source) {
  if (SOURCES_ENCAISSEMENT.includes(source)) return "ENCAISSEMENT";
  if (SOURCES_DECAISSEMENT.includes(source)) return "DECAISSEMENT";
  if (source === "TRANSFERT") return "TRANSFERT";
  return "AUTRE";
}

export default function TransactionsClient({ comptes, transactions }) {
  const [periode, setPeriode] = useState("MOIS");
  const [dateDebut, setDateDebut] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [dateFin, setDateFin] = useState(new Date().toISOString().slice(0, 10));
  const [compteId, setCompteId] = useState("TOUS");
  const [type, setType] = useState("TOUS");

  const transactionsFiltrees = useMemo(() => {
    const maintenant = new Date();
    let bornDebut = null;
    let bornFin = null;
    if (periode === "AUJOURDHUI") {
      bornDebut = new Date(maintenant); bornDebut.setHours(0, 0, 0, 0);
    } else if (periode === "7J") {
      bornDebut = new Date(maintenant.getTime() - 7 * 86400000);
    } else if (periode === "MOIS") {
      bornDebut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    } else if (periode === "PERSONNALISE") {
      bornDebut = new Date(`${dateDebut}T00:00:00`);
      bornFin = new Date(`${dateFin}T23:59:59`);
    }

    return transactions.filter((t) => {
      const d = new Date(t.date);
      if (bornDebut && d < bornDebut) return false;
      if (bornFin && d > bornFin) return false;
      if (compteId !== "TOUS" && t.compteTresorerieId !== compteId) return false;
      if (type !== "TOUS" && typeDeSource(t.source) !== type) return false;
      return true;
    });
  }, [transactions, periode, dateDebut, dateFin, compteId, type]);

  const totalEntrees = transactionsFiltrees.reduce((s, t) => s + t.debit, 0);
  const totalSorties = transactionsFiltrees.reduce((s, t) => s + t.credit, 0);

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite/caisse-banque" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Caisse & Banque</Link>
      <h1 style={{ fontSize: 20, margin: "8px 0 12px" }}>📋 Transactions</h1>

      <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto" }}>
        {PERIODES.map((p) => (
          <button key={p.valeur} onClick={() => setPeriode(p.valeur)} style={bouton(periode === p.valeur)}>{p.label}</button>
        ))}
      </div>

      {periode === "PERSONNALISE" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} style={champStyle} />
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} style={champStyle} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select value={compteId} onChange={(e) => setCompteId(e.target.value)} style={{ ...champStyle, flex: 1, marginBottom: 0 }}>
          <option value="TOUS">Tous les comptes</option>
          {comptes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {TYPES.map((t) => (
          <button key={t.valeur} onClick={() => setType(t.valeur)} style={bouton(type === t.valeur)}>{t.label}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Entrées</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--success)" }}>{totalEntrees.toFixed(2)} $</div>
        </div>
        <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Sorties</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--danger)" }}>{totalSorties.toFixed(2)} $</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {transactionsFiltrees.map((t) => (
          <div key={t.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.description}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                {new Date(t.date).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} · {t.numero} · {t.compteTresorerieNom}
              </div>
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: t.debit > 0 ? "var(--success)" : "var(--danger)", whiteSpace: "nowrap" }}>
              {t.debit > 0 ? "+" : "−"}{(t.debit || t.credit).toFixed(2)} $
            </span>
          </div>
        ))}
        {transactionsFiltrees.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune transaction pour ce filtre.</p>
        )}
      </div>
    </div>
  );
}

function bouton(actif) {
  return {
    fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap", cursor: "pointer",
    background: actif ? "var(--accent)" : "var(--surface)",
    color: actif ? "#17150f" : "var(--text-muted)",
    border: "1px solid var(--border)",
  };
}

const champStyle = {
  padding: "8px 9px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 12.5, flex: 1,
};
