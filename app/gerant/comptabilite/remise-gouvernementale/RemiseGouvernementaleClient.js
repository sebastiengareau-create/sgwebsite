"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { TEINTES, TitrePanneau, stylePanneau, CarteChiffre, GrilleChiffres } from "../../../components/StyleSection";

export default function RemiseGouvernementaleClient({ soldes }) {
  const router = useRouter();
  const [montants, setMontants] = useState(
    Object.fromEntries(soldes.map((c) => [c.numero, c.solde > 0.005 ? c.solde.toFixed(2) : ""]))
  );
  const [groupeAPayer, setGroupeAPayer] = useState(null); // groupe en train d'être payé (formulaire de référence ouvert)
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  const groupes = [...new Set(soldes.map((c) => c.groupe))];
  const infoGroupe = (groupe) => soldes.find((c) => c.groupe === groupe);
  const libelleGroupe = (groupe) => {
    const { titre, precision } = infoGroupe(groupe);
    return precision ? `${titre} — ${precision}` : titre;
  };

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
      body: JSON.stringify({ paiements, description: `Remise ${libelleGroupe(groupe)}`, reference }),
    });
    const data = await res.json();
    setEnCours(false);
    if (!res.ok) {
      setMessage({ type: "erreur", texte: data.erreur });
      return;
    }
    setMessage({ type: "succes", texte: `Remise ${libelleGroupe(groupe)} de ${argent(data.total)} enregistrée ✓` });
    setMontants((prev) => {
      const copie = { ...prev };
      soldes.filter((c) => c.groupe === groupe).forEach((c) => (copie[c.numero] = ""));
      return copie;
    });
    setGroupeAPayer(null);
    router.refresh();
  }

  const TEINTES_GROUPES = [TEINTES.rouge, TEINTES.bleu, TEINTES.vert, TEINTES.ambre];
  const teinteGroupe = (groupe) => TEINTES_GROUPES[groupes.indexOf(groupe) % TEINTES_GROUPES.length];
  const soldeGroupe = (groupe) => soldes.filter((c) => c.groupe === groupe).reduce((s, c) => s + Math.max(0, c.solde), 0);

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="🏛️" titre="Remise gouvernementale" sousTitre="Règle ce que tu dois déjà : TPS, TVQ et retenues sur la paie. Chaque groupe se paie séparément, avec sa propre référence." />
      </div>

      <GrilleChiffres>
        {groupes.map((groupe) => (
          <CarteChiffre
            key={groupe} titre={`À remettre — ${libelleGroupe(groupe)}`} montant={argent(soldeGroupe(groupe))}
            teinte={teinteGroupe(groupe).couleur} couleur={soldeGroupe(groupe) > 0.005 ? "var(--text)" : "var(--success)"}
            note={soldeGroupe(groupe) > 0.005 ? "Solde aux livres" : "Rien à remettre"}
          />
        ))}
      </GrilleChiffres>

      {message && (
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: message.type === "succes" ? "var(--success)" : "var(--danger)" }}>{message.texte}</p>
      )}

      {groupes.map((groupe) => {
        const teinte = teinteGroupe(groupe);
        const total = totalGroupe(groupe);
        return (
          <div key={groupe} style={{ ...stylePanneau, position: "relative", overflow: "hidden", paddingLeft: 22 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: teinte.couleur }} />
            <TitrePanneau icone="banque" teinte={teinte} titre={infoGroupe(groupe).titre} sousTitre={infoGroupe(groupe).precision || null} />
            <div style={{ display: "flex", padding: "0 4px 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: `2px solid ${teinte.couleur}` }}>
              <span style={{ flex: 1 }}>Compte</span>
              <span>Montant à payer</span>
            </div>
            {soldes.filter((c) => c.groupe === groupe).map((c, i) => (
              <div key={c.numero} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.nom}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.numero} · solde {argent(c.solde)}</div>
                </div>
                <input
                  type="number" min={0} step="0.01" value={montants[c.numero]}
                  onChange={(e) => changer(c.numero, e.target.value)}
                  placeholder="0.00"
                  style={{ width: 110, padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, textAlign: "right", fontWeight: 700 }}
                />
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10, padding: "12px 14px", borderRadius: 12, background: "var(--bg)" }}>
              <span>
                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Total du paiement</span>
                <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{argent(total)}</span>
              </span>
              {groupeAPayer !== groupe && (
                <button
                  onClick={() => setGroupeAPayer(groupe)}
                  disabled={total <= 0}
                  style={{
                    flex: "1 1 100%", padding: "11px 18px", borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700,
                    background: total > 0 ? "var(--accent)" : "var(--surface-alt)", color: total > 0 ? "#221f18" : "var(--text-muted)",
                    cursor: total > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  Payer {infoGroupe(groupe).titre}{infoGroupe(groupe).precision ? ` (${infoGroupe(groupe).precision})` : ""}
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
        );
      })}
    </div>
  );
}

function FormulaireReferenceRemise({ enCours, onConfirmer, onAnnuler }) {
  const [reference, setReference] = useState("");

  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 12, padding: 12, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        placeholder="No de chèque ou de transaction (optionnel)" value={reference}
        onChange={(e) => setReference(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14 }}
        autoFocus
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onConfirmer(reference)} disabled={enCours} style={{ flex: 1, padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 700, border: "none", background: "var(--success)", color: "#fff", cursor: "pointer" }}>
          {enCours ? "…" : "✓ Confirmer le paiement"}
        </button>
        <button onClick={onAnnuler} style={{ flex: 1, padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 700, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
