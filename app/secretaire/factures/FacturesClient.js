"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BoutonFlottantNouveau from "../../components/BoutonFlottantNouveau";
import SelecteurCompteMode, { compteParDefaut } from "../../components/SelecteurCompteMode";

const STATUTS = {
  IMPAYEE: { label: "Impayée", color: "#C9A227" },
  PAYEE: { label: "Payée", color: "#6FA96B" },
  ANNULEE: { label: "Annulée", color: "#C15B4A" },
};

export default function FacturesClient({ factures, comptesTresorerie }) {
  const router = useRouter();
  const [filtre, setFiltre] = useState("IMPAYEE");
  const [recherche, setRecherche] = useState("");
  const [avertissement, setAvertissement] = useState("");
  const [factureAPayer, setFactureAPayer] = useState(null); // id de la facture en train d'être marquée payée

  const facturesFiltrees = factures.filter((f) => {
    if (filtre !== "TOUTES" && f.statut !== filtre) return false;
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return f.numero.toLowerCase().includes(q) || f.bon.client.nom.toLowerCase().includes(q) || f.bon.numero.toLowerCase().includes(q);
  });

  const totalImpaye = factures.filter((f) => f.statut === "IMPAYEE").reduce((s, f) => s + f.totalFacture, 0);
  const totalPaye = factures.filter((f) => f.statut === "PAYEE").reduce((s, f) => s + f.totalFacture, 0);

  async function marquerPayee(id, compteTresorerieId, modePaiement) {
    setAvertissement("");
    const res = await fetch(`/api/factures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "PAYEE", compteTresorerieId, modePaiement }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.erreur || "Erreur.";
    if (data.avertissementComptable) {
      setAvertissement(`Facture marquée payée, mais aucune écriture comptable créée : ${data.avertissementComptable}.`);
    }
    setFactureAPayer(null);
    router.refresh();
    return null;
  }

  return (
    <div className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Factures</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
        {factures.length} facture{factures.length !== 1 ? "s" : ""} émise{factures.length !== 1 ? "s" : ""} au total.
      </p>
      {avertissement && <p style={{ fontSize: 12, color: "var(--accent)", marginBottom: 12 }}>⚠️ {avertissement}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#C9A227" }}>{totalImpaye.toFixed(2)} $</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total impayé</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#6FA96B" }}>{totalPaye.toFixed(2)} $</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total payé</div>
        </div>
      </div>

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher par numéro ou client…"
        style={{
          width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--text)", fontSize: 13, marginBottom: 12, boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {["IMPAYEE", "PAYEE", "ANNULEE", "TOUTES"].map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            style={{
              fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap", cursor: "pointer",
              background: filtre === f ? "var(--accent)" : "var(--surface)",
              color: filtre === f ? "#17150f" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {f === "TOUTES" ? "Toutes" : STATUTS[f].label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {facturesFiltrees.map((f) => {
          const joursEcoules = Math.floor((Date.now() - new Date(f.dateEmission).getTime()) / 86400000);
          const enRetard = f.statut === "IMPAYEE" && joursEcoules > 30;
          return (
          <div key={f.id} style={{ background: "var(--surface)", border: enRetard ? "1px solid var(--danger)" : "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `3px solid ${STATUTS[f.statut].color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Link href={`/bons/${f.bon.id}`} style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "var(--text)", textDecoration: "none" }}>
                #{f.numero}
              </Link>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {enRetard && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#17150f", background: "var(--danger)", padding: "2px 7px", borderRadius: 999 }}>
                    ⚠ {joursEcoules}j
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUTS[f.statut].color }}>{STATUTS[f.statut].label}</span>
              </div>
            </div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{f.bon.client.nom}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(f.dateEmission).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{f.totalFacture.toFixed(2)} $</span>
              {f.statut === "IMPAYEE" && factureAPayer !== f.id && (
                <button
                  onClick={() => setFactureAPayer(f.id)}
                  className="bouton-3d"
                  style={{ fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 8 }}
                >
                  Marquer payée
                </button>
              )}
            </div>
            {factureAPayer === f.id && (
              <FormulaireEncaissement
                comptesTresorerie={comptesTresorerie}
                onConfirmer={(compteTresorerieId, modePaiement) => marquerPayee(f.id, compteTresorerieId, modePaiement)}
                onAnnuler={() => setFactureAPayer(null)}
              />
            )}
          </div>
          );
        })}
        {facturesFiltrees.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 12 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🧾</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Aucune facture pour ce filtre — les factures se créent depuis un bon de commande terminé.</p>
          </div>
        )}
      </div>
      <BoutonFlottantNouveau />
    </div>
  );
}

function FormulaireEncaissement({ comptesTresorerie, onConfirmer, onAnnuler }) {
  const [compteTresorerieId, setCompteTresorerieId] = useState(compteParDefaut(comptesTresorerie));
  const [modePaiement, setModePaiement] = useState("CARTE_DEBIT");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function confirmer() {
    if (!compteTresorerieId) { setErreur("Aucun compte de trésorerie disponible."); return; }
    setErreur("");
    setEnCours(true);
    const erreurRes = await onConfirmer(compteTresorerieId, modePaiement);
    setEnCours(false);
    if (erreurRes) setErreur(erreurRes);
  }

  return (
    <div style={{ background: "var(--bg)", borderRadius: 8, padding: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <SelecteurCompteMode
        comptes={comptesTresorerie}
        compteTresorerieId={compteTresorerieId} setCompteTresorerieId={setCompteTresorerieId}
        modePaiement={modePaiement} setModePaiement={setModePaiement}
      />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5, margin: 0 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={confirmer} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "…" : "✓ Confirmer l'encaissement"}
        </button>
        <button onClick={onAnnuler} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
