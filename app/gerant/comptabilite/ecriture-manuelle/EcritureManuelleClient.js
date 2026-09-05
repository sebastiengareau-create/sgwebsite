"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dateAujourdhuiQuebec } from "@/lib/temps";

const TYPES_ORDRE = ["ACTIF", "PASSIF", "CAPITAUX_PROPRES", "REVENU", "DEPENSE"];
const LABEL_TYPE = {
  ACTIF: "🟦 Actifs",
  PASSIF: "🟥 Passifs",
  CAPITAUX_PROPRES: "🟩 Capitaux propres",
  REVENU: "🟨 Revenus",
  DEPENSE: "🟧 Dépenses",
};

function nouvelleLigne() {
  return { id: Math.random().toString(36).slice(2), compteNumero: "", debit: "", credit: "" };
}

export default function EcritureManuelleClient({ comptes }) {
  const router = useRouter();
  const [date, setDate] = useState(dateAujourdhuiQuebec());
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lignes, setLignes] = useState([nouvelleLigne(), nouvelleLigne()]);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  const comptesParType = TYPES_ORDRE.map((type) => ({ type, comptes: comptes.filter((c) => c.type === type) }));

  const totalDebit = lignes.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lignes.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const equilibree = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;
  const lignesCompletes = lignes.filter((l) => l.compteNumero && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
  const peutSoumettre = equilibree && lignesCompletes.length >= 2 && lignesCompletes.length === lignes.length && description.trim() && !enCours;

  function modifierLigne(id, champ, valeur) {
    setLignes((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const maj = { ...l, [champ]: valeur };
      // Une ligne n'a qu'un seul côté à la fois — remplir l'un vide l'autre
      if (champ === "debit" && valeur) maj.credit = "";
      if (champ === "credit" && valeur) maj.debit = "";
      return maj;
    }));
  }

  function ajouterLigne() {
    setLignes((prev) => [...prev, nouvelleLigne()]);
  }

  function retirerLigne(id) {
    setLignes((prev) => prev.length > 2 ? prev.filter((l) => l.id !== id) : prev);
  }

  async function soumettre(e) {
    e.preventDefault();
    setMessage(null);
    if (!peutSoumettre) return;
    setEnCours(true);
    const res = await fetch("/api/comptabilite/ecritures-manuelles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        reference: reference.trim() || undefined,
        description: description.trim(),
        lignes: lignes.map((l) => ({
          compteNumero: l.compteNumero,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setMessage({ type: "erreur", texte: data.erreur || "Erreur lors de l'enregistrement." });
      return;
    }
    setMessage({ type: "succes", texte: `Écriture ${data.numero} enregistrée ✓` });
    setReference("");
    setDescription("");
    setLignes([nouvelleLigne(), nouvelleLigne()]);
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite/journal" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au journal</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>✍️ Écriture supplémentaire</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Corrections, ajustements, amortissements, écritures de fin de période — peut toucher n'importe quel compte du
        plan comptable, pas seulement les dépenses. Chaque écriture doit être équilibrée (débits = crédits).
      </p>

      <form onSubmit={soumettre}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={champStyle} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Référence (optionnel)</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. AJ-000125" style={champStyle} />
            </div>
          </div>
          <label style={labelStyle}>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. Ajustement inventaire" style={{ ...champStyle, marginBottom: 0 }} required />
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Lignes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lignes.map((l) => (
              <div key={l.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select
                  value={l.compteNumero}
                  onChange={(e) => modifierLigne(l.id, "compteNumero", e.target.value)}
                  style={{ ...champStyle, flex: 2, marginBottom: 0, fontSize: 12.5 }}
                >
                  <option value="">Compte G/L…</option>
                  {comptesParType.map(({ type, comptes: comptesDuType }) => (
                    comptesDuType.length === 0 ? null : (
                      <optgroup key={type} label={LABEL_TYPE[type]}>
                        {comptesDuType.map((c) => (
                          <option key={c.numero} value={c.numero}>{c.numero} — {c.nom}</option>
                        ))}
                      </optgroup>
                    )
                  ))}
                </select>
                <input
                  type="number" min={0} step="0.01" placeholder="Débit"
                  value={l.debit} onChange={(e) => modifierLigne(l.id, "debit", e.target.value)}
                  style={{ ...champStyle, flex: 1, marginBottom: 0, textAlign: "right" }}
                />
                <input
                  type="number" min={0} step="0.01" placeholder="Crédit"
                  value={l.credit} onChange={(e) => modifierLigne(l.id, "credit", e.target.value)}
                  style={{ ...champStyle, flex: 1, marginBottom: 0, textAlign: "right" }}
                />
                <button type="button" onClick={() => retirerLigne(l.id)} disabled={lignes.length <= 2} style={boutonRetirer}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={ajouterLigne} style={boutonAjouterLigne}>+ Ajouter une ligne</button>

          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)" }}>Total débits</span>
            <span style={{ fontWeight: 700 }}>{totalDebit.toFixed(2)} $</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: "var(--text-muted)" }}>Total crédits</span>
            <span style={{ fontWeight: 700 }}>{totalCredit.toFixed(2)} $</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: equilibree ? "var(--success)" : "var(--danger)" }}>
            {equilibree ? "🟢 Écriture équilibrée" : `🔴 Déséquilibrée — écart de ${Math.abs(totalDebit - totalCredit).toFixed(2)} $`}
          </div>
        </div>

        {message && (
          <p style={{ fontSize: 12.5, color: message.type === "succes" ? "var(--success)" : "var(--danger)", marginBottom: 10 }}>
            {message.texte}
          </p>
        )}

        <button
          type="submit"
          disabled={!peutSoumettre}
          style={{
            width: "100%", padding: 12, borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14,
            background: peutSoumettre ? "var(--accent)" : "var(--surface)",
            color: peutSoumettre ? "#17150f" : "var(--text-muted)",
            cursor: peutSoumettre ? "pointer" : "not-allowed",
          }}
        >
          {enCours ? "Enregistrement…" : "Enregistrer l'écriture"}
        </button>
      </form>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const boutonAjouterLigne = { marginTop: 8, fontSize: 11.5, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 };
const boutonRetirer = { flexShrink: 0, fontSize: 12, color: "var(--danger)", background: "none", border: "1px solid var(--border)", borderRadius: 6, width: 28, height: 34, cursor: "pointer" };
