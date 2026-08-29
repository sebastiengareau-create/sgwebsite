"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ORDRE_TYPE = ["ACTIF", "PASSIF", "CAPITAUX_PROPRES", "REVENU", "DEPENSE"];
const COULEUR_TYPE = { ACTIF: "#4F82C0", PASSIF: "#C9A227", CAPITAUX_PROPRES: "#9C978A", REVENU: "#6FA96B", DEPENSE: "#C15B4A" };

export default function PlanComptableClient({ comptes, labelsType, dateVerrouInit }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [numero, setNumero] = useState("");
  const [nom, setNom] = useState("");
  const [type, setType] = useState("DEPENSE");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [dateVerrou, setDateVerrou] = useState(dateVerrouInit);
  const [verrouEnCours, setVerrouEnCours] = useState(false);

  async function sauvegarderVerrou(nouvelleDate) {
    setVerrouEnCours(true);
    await fetch("/api/comptabilite/verrouillage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: nouvelleDate || null }),
    });
    setDateVerrou(nouvelleDate);
    setVerrouEnCours(false);
    router.refresh();
  }

  const totalActif = comptes.filter((c) => c.type === "ACTIF").reduce((s, c) => s + c.solde, 0);
  const totalPassif = comptes.filter((c) => c.type === "PASSIF").reduce((s, c) => s + c.solde, 0);
  const totalRevenu = comptes.filter((c) => c.type === "REVENU").reduce((s, c) => s + c.solde, 0);
  const totalDepense = comptes.filter((c) => c.type === "DEPENSE").reduce((s, c) => s + c.solde, 0);
  const profitNet = totalRevenu - totalDepense;

  async function creerCompte(e) {
    e.preventDefault();
    setErreur("");
    if (!numero.trim() || !nom.trim()) {
      setErreur("Numéro et nom requis.");
      return;
    }
    setEnCours(true);
    const res = await fetch("/api/comptabilite/comptes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero, nom, type }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    setNumero(""); setNom(""); setAfficherFormulaire(false);
    router.refresh();
  }

  async function desactiverCompte(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Retirer ce compte du plan comptable ? Son historique reste intact, il sera juste caché de cette liste.")) return;
    await fetch(`/api/comptabilite/comptes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: false }),
    });
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>Comptabilité</h1>
        <Link href="/gerant/comptabilite/journal" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 8 }}>
          📖 Journal
        </Link>
      </div>

      <div style={{ background: dateVerrou ? "rgba(193,91,74,0.12)" : "var(--surface)", border: `1px solid ${dateVerrou ? "var(--danger)" : "var(--border)"}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: dateVerrou ? "var(--danger)" : "var(--text-muted)", fontWeight: 700, marginBottom: 6 }}>
          🔒 Verrouillage de période
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 }}>
          Empêche de modifier ou supprimer une écriture, une paie ou une dépense datée à cette date ou avant — pour protéger un mois déjà clôturé.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="date" value={dateVerrou || ""} onChange={(e) => setDateVerrou(e.target.value)}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
          />
          <button
            onClick={() => sauvegarderVerrou(dateVerrou)}
            disabled={verrouEnCours}
            className="bouton-3d"
            style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
          >
            Verrouiller
          </button>
        </div>
        {dateVerrouInit && (
          <button
            onClick={() => sauvegarderVerrou("")}
            disabled={verrouEnCours}
            style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 8, border: "1px dashed var(--danger)", background: "none", color: "var(--danger)", fontSize: 11.5, cursor: "pointer" }}
          >
            🔓 Déverrouiller complètement
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <Link href="/gerant/comptabilite/etat-resultats" className="bouton-3d" style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
          📊 État des résultats
        </Link>
        <Link href="/gerant/comptabilite/bilan" className="bouton-3d" style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
          ⚖️ Bilan
        </Link>
      </div>
      <Link href="/gerant/comptabilite/ouverture" style={{ display: "block", textAlign: "center", fontSize: 12, color: "var(--text-muted)", textDecoration: "underline", marginBottom: 12 }}>
        + Soldes d'ouverture
      </Link>
      <Link
        href="/gerant/comptabilite/rapprochement"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 8 }}
      >
        🏦 Rapprochement bancaire
      </Link>
      <Link
        href="/gerant/comptabilite/comptes-a-payer"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 8 }}
      >
        💳 Comptes à payer
      </Link>
      <Link
        href="/gerant/comptabilite/immobilisations"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 8 }}
      >
        🏗️ Immobilisations
      </Link>
      <Link
        href="/gerant/comptabilite/remise-gouvernementale"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 8 }}
      >
        🏛️ Payer une remise gouvernementale
      </Link>
      <Link
        href="/gerant/comptabilite/rapports"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 16 }}
      >
        📄 Rapports imprimables
      </Link>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
        Plan comptable — les écritures se génèrent automatiquement à partir de tes factures.
      </p>

      <button
        onClick={() => setAfficherFormulaire((v) => !v)}
        className="bouton-3d-sombre"
        style={{ width: "100%", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, marginBottom: 16 }}
      >
        {afficherFormulaire ? "Annuler" : "+ Nouveau compte"}
      </button>

      {afficherFormulaire && (
        <form onSubmit={creerCompte} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Numéro (ex : 4060)" value={numero} onChange={(e) => setNumero(e.target.value)}
              style={{ width: 110, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "monospace" }}
            />
            <input
              placeholder="Nom du compte" value={nom} onChange={(e) => setNom(e.target.value)}
              style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
            />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%", marginTop: 8, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}>
            {ORDRE_TYPE.map((t) => <option key={t} value={t}>{labelsType[t]}</option>)}
          </select>
          {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
          <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            {enCours ? "Création…" : "Créer le compte"}
          </button>
        </form>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--success)" }}>{totalRevenu.toFixed(2)} $</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Revenus totaux</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: profitNet >= 0 ? "var(--success)" : "var(--danger)" }}>{profitNet.toFixed(2)} $</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Profit net (à ce jour)</div>
        </div>
      </div>

      {ORDRE_TYPE.map((type) => {
        const comptesType = comptes.filter((c) => c.type === type);
        if (comptesType.length === 0) return null;
        return (
          <div key={type} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: COULEUR_TYPE[type], fontWeight: 700, marginBottom: 8 }}>
              {labelsType[type]}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {comptesType.map((c) => (
                <Link key={c.id} href={`/gerant/comptabilite/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginRight: 6 }}>{c.numero}</span>
                      <span style={{ fontSize: 13 }}>{c.nom}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{c.solde.toFixed(2)} $</span>
                      {c.nbEcritures === 0 && (
                        <button onClick={(e) => desactiverCompte(c.id, e)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>✕</button>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 10 }}>
        Actif total : {totalActif.toFixed(2)} $ · Passif total : {totalPassif.toFixed(2)} $
      </p>
    </div>
  );
}
