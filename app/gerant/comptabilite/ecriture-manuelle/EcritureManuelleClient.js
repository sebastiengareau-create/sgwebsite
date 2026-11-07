"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import { argent } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { TEINTES, TitrePanneau, stylePanneau, Pastille } from "../../../components/StyleSection";

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
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="✍️" titre="Écriture supplémentaire" sousTitre="Corrections, ajustements, amortissements, fin de période — n'importe quel compte du plan comptable." />
      </div>

      <form onSubmit={soumettre}>
        <div style={stylePanneau}>
          <TitrePanneau icone="crayon" teinte={TEINTES.ambre} titre="Écriture" sousTitre="Date, référence et description" />
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}>
              <label style={labelStyle}>Date</label>
              <input type="date" max="9999-12-31" value={date} onChange={(e) => setDate(e.target.value)} style={champStyle} required />
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <label style={labelStyle}>Référence (optionnel)</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. AJ-000125" style={champStyle} />
            </div>
          </div>
          <label style={labelStyle}>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. Ajustement inventaire" style={{ ...champStyle, marginBottom: 0 }} required />
        </div>

        <div style={stylePanneau}>
          <TitrePanneau
            icone="balance" teinte={TEINTES.bleu} titre="Lignes" sousTitre="Chaque écriture doit être équilibrée : débits = crédits"
            droite={<Pastille couleur="var(--bleu)" fond="var(--bleu-fond)">{lignes.length} lignes</Pastille>}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lignes.map((l, i) => (
              <div key={l.id} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", padding: 10, borderRadius: 12, background: "var(--bg)" }}>
                <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, background: "var(--bleu-fond)", color: "var(--bleu)", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <select
                  value={l.compteNumero}
                  onChange={(e) => modifierLigne(l.id, "compteNumero", e.target.value)}
                  style={{ ...champStyle, flex: "1 1 200px", marginBottom: 0, fontSize: 13.5, background: "var(--surface)" }}
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
                  style={{ ...champStyle, flex: "1 1 90px", marginBottom: 0, textAlign: "right", background: "var(--surface)" }}
                />
                <input
                  type="number" min={0} step="0.01" placeholder="Crédit"
                  value={l.credit} onChange={(e) => modifierLigne(l.id, "credit", e.target.value)}
                  style={{ ...champStyle, flex: "1 1 90px", marginBottom: 0, textAlign: "right", background: "var(--surface)" }}
                />
                <button type="button" onClick={() => retirerLigne(l.id)} disabled={lignes.length <= 2} style={boutonRetirer}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={ajouterLigne} style={boutonAjouterLigne}>+ Ajouter une ligne</button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            {[["Total débits", totalDebit], ["Total crédits", totalCredit]].map(([libelle, total]) => (
              <div key={libelle} style={{ background: "var(--bg)", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{libelle}</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{argent(total)}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 10, padding: "10px 12px", borderRadius: 12, fontSize: 14, fontWeight: 800,
            background: equilibree ? "var(--success-fond)" : "var(--danger-fond)", color: equilibree ? "var(--success)" : "var(--danger)",
            borderLeft: `4px solid ${equilibree ? "var(--success)" : "var(--danger)"}`,
          }}>
            {equilibree ? "✓ Écriture équilibrée" : `Déséquilibrée — écart de ${argent(Math.abs(totalDebit - totalCredit))}`}
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
            width: "100%", padding: 13, borderRadius: 12, border: "none", fontWeight: 700, fontSize: 15, marginBottom: 24,
            background: peutSoumettre ? "var(--accent)" : "var(--surface-alt)",
            color: peutSoumettre ? "#221f18" : "var(--text-muted)",
            cursor: peutSoumettre ? "pointer" : "not-allowed",
          }}
        >
          {enCours ? "Enregistrement…" : "Enregistrer l'écriture"}
        </button>
      </form>
    </div>
  );
}

const labelStyle = { fontSize: 13, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 4 };
const champStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 14, marginBottom: 8, boxSizing: "border-box",
};
const boutonAjouterLigne = { width: "100%", marginTop: 10, padding: 10, fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)", background: "none", border: "1px dashed var(--accent)", borderRadius: 12, cursor: "pointer" };
const boutonRetirer = { flexShrink: 0, fontSize: 13, color: "var(--danger)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, width: 38, height: 40, cursor: "pointer" };
