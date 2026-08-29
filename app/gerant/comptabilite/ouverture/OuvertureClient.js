"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const LABELS_TYPE = { ACTIF: "Actif", PASSIF: "Passif", CAPITAUX_PROPRES: "Capitaux propres", REVENU: "Revenus", DEPENSE: "Dépenses" };
const ORDRE_TYPE = ["ACTIF", "PASSIF", "CAPITAUX_PROPRES", "REVENU", "DEPENSE"];

export default function OuvertureClient({ comptes }) {
  const router = useRouter();
  const [montants, setMontants] = useState({});
  const [erreur, setErreur] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);

  const totalDebit = comptes
    .filter((c) => ["ACTIF", "DEPENSE"].includes(c.type))
    .reduce((s, c) => s + (Number(montants[c.numero]) || 0), 0);
  const totalCredit = comptes
    .filter((c) => !["ACTIF", "DEPENSE"].includes(c.type))
    .reduce((s, c) => s + (Number(montants[c.numero]) || 0), 0);
  const difference = totalDebit - totalCredit;

  async function enregistrer(e) {
    e.preventDefault();
    setErreur("");
    setConfirmation("");

    const soldes = Object.entries(montants)
      .filter(([, v]) => Number(v) > 0)
      .map(([compteNumero, montant]) => ({ compteNumero, montant: Number(montant) }));

    if (soldes.length === 0) {
      setErreur("Entre au moins un solde.");
      return;
    }

    setEnCours(true);
    const res = await fetch("/api/comptabilite/ouverture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldes }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setConfirmation("Soldes d'ouverture enregistrés ✓");
    setMontants({});
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au plan comptable</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>Soldes d'ouverture</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Les montants déjà présents avant de commencer à utiliser la comptabilité (ex. solde de banque actuel).
        La contrepartie s'équilibre automatiquement — pas besoin de calculer toi-même.
      </p>

      <form onSubmit={enregistrer}>
        {ORDRE_TYPE.map((type) => {
          const comptesType = comptes.filter((c) => c.type === type);
          if (comptesType.length === 0) return null;
          return (
            <div key={type} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>{LABELS_TYPE[type]}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {comptesType.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, flex: 1 }}>{c.nom}</span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>$</span>
                    <input
                      type="number" min={0} step="0.01" placeholder="0.00"
                      value={montants[c.numero] || ""}
                      onChange={(e) => setMontants((prev) => ({ ...prev, [c.numero]: e.target.value }))}
                      style={{ width: 100, padding: "7px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, textAlign: "right" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>Total débit (actif + dépenses)</span>
            <span>{totalDebit.toFixed(2)} $</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>Total crédit (passif + capitaux + revenus)</span>
            <span>{totalCredit.toFixed(2)} $</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-muted)" }}>Contrepartie automatique (Soldes d'ouverture)</span>
            <span style={{ fontWeight: 700 }}>{Math.abs(difference).toFixed(2)} $</span>
          </div>
        </div>

        {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}
        {confirmation && <p style={{ color: "var(--success)", fontSize: 12, marginBottom: 10 }}>{confirmation}</p>}

        <button
          type="submit" disabled={enCours}
          style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, cursor: "pointer" }}
        >
          {enCours ? "Enregistrement…" : "Enregistrer les soldes d'ouverture"}
        </button>
      </form>
    </div>
  );
}
