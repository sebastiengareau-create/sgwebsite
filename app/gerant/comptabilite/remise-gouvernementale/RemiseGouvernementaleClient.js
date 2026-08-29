"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RemiseGouvernementaleClient({ soldes }) {
  const router = useRouter();
  const [montants, setMontants] = useState(
    Object.fromEntries(soldes.map((c) => [c.numero, c.solde > 0.005 ? c.solde.toFixed(2) : ""]))
  );
  const [groupeAPayer, setGroupeAPayer] = useState(null); // groupe en train d'être payé (formulaire de référence ouvert)
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  const groupes = [...new Set(soldes.map((c) => c.groupe))];

  function changer(numero, valeur) {
    setMontants((prev) => ({ ...prev, [numero]: valeur }));
  }

  function totalGroupe(groupe) {
    return soldes.filter((c) => c.groupe === groupe).reduce((s, c) => s + (Number(montants[c.numero]) || 0), 0);
  }

  async function payerGroupe(groupe, reference) {
    const paiements = soldes
      .filter((c) => c.groupe === groupe && Number(montants[c.numero]) > 0)
      .map((c) => ({ compteNumero: c.numero, montant: Number(montants[c.numero]), description: c.nom }));

    if (paiements.length === 0) {
      setMessage({ type: "erreur", texte: "Aucun montant à payer pour ce groupe." });
      return;
    }

    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/comptabilite/remise-gouvernementale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paiements, description: `Remise ${groupe}`, reference }),
    });
    const data = await res.json();
    setEnCours(false);
    if (!res.ok) {
      setMessage({ type: "erreur", texte: data.erreur });
      return;
    }
    setMessage({ type: "succes", texte: `Remise ${groupe} de ${data.total.toFixed(2)} $ enregistrée ✓` });
    setMontants((prev) => {
      const copie = { ...prev };
      soldes.filter((c) => c.groupe === groupe).forEach((c) => (copie[c.numero] = ""));
      return copie;
    });
    setGroupeAPayer(null);
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au plan comptable</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>🏛️ Payer une remise gouvernementale</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Règle ce que tu dois déjà — débite directement les comptes concernés, sort l'argent de la banque. Chaque
        groupe se paie séparément, avec sa propre référence (chèque ou transaction).
      </p>

      {message && (
        <p style={{ fontSize: 12, marginBottom: 12, color: message.type === "succes" ? "var(--success)" : "var(--danger)" }}>{message.texte}</p>
      )}

      {groupes.map((groupe) => (
        <div key={groupe} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, fontWeight: 700 }}>{groupe}</div>
          {soldes.filter((c) => c.groupe === groupe).map((c) => (
            <div key={c.numero} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 13 }}>{c.nom}</span>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>solde {c.solde.toFixed(2)} $</span>
              <input
                type="number" min={0} step="0.01" value={montants[c.numero]}
                onChange={(e) => changer(c.numero, e.target.value)}
                placeholder="0.00"
                style={{ width: 90, padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, textAlign: "right" }}
              />
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{totalGroupe(groupe).toFixed(2)} $</span>
            {groupeAPayer !== groupe && (
              <button
                onClick={() => setGroupeAPayer(groupe)}
                disabled={totalGroupe(groupe) <= 0}
                className="bouton-3d"
                style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, opacity: totalGroupe(groupe) <= 0 ? 0.4 : 1 }}
              >
                Payer {groupe}
              </button>
            )}
          </div>

          {groupeAPayer === groupe && (
            <FormulaireReferenceRemise
              enCours={enCours}
              onConfirmer={(reference) => payerGroupe(groupe, reference)}
              onAnnuler={() => setGroupeAPayer(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FormulaireReferenceRemise({ enCours, onConfirmer, onAnnuler }) {
  const [reference, setReference] = useState("");

  return (
    <div style={{ background: "var(--bg)", borderRadius: 8, padding: 10, marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <input
        placeholder="No de chèque ou de transaction (optionnel)" value={reference}
        onChange={(e) => setReference(e.target.value)}
        style={{ padding: "8px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12.5 }}
        autoFocus
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onConfirmer(reference)} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "…" : "✓ Confirmer le paiement"}
        </button>
        <button onClick={onAnnuler} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
