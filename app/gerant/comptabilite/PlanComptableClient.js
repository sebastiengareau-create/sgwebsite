"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ORDRE_TYPE = ["ACTIF", "PASSIF", "CAPITAUX_PROPRES", "REVENU", "DEPENSE"];
const COULEUR_TYPE = { ACTIF: "#4F82C0", PASSIF: "#C9A227", CAPITAUX_PROPRES: "#9C978A", REVENU: "#6FA96B", DEPENSE: "#C15B4A" };

export default function PlanComptableClient({ comptes, labelsType, estDeveloppeur }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [numero, setNumero] = useState("");
  const [nom, setNom] = useState("");
  const [type, setType] = useState("DEPENSE");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [renommageId, setRenommageId] = useState(null);
  const [nomRenommage, setNomRenommage] = useState("");
  const [erreurRenommage, setErreurRenommage] = useState("");

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

  function commencerRenommage(compte, e) {
    e.preventDefault();
    e.stopPropagation();
    setErreurRenommage("");
    setRenommageId(compte.id);
    setNomRenommage(compte.nom);
  }

  async function sauvegarderRenommage(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!nomRenommage.trim()) return;
    setErreurRenommage("");
    const res = await fetch(`/api/comptabilite/comptes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nomRenommage.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreurRenommage(data.erreur || "Erreur lors du renommage.");
      return;
    }
    setRenommageId(null);
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

      <Link
        href="/gerant/comptabilite/fermeture"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 8 }}
      >
        🔒 Fermeture de période
      </Link>
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
        href="/gerant/comptabilite/ecriture-manuelle"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 8 }}
      >
        ✍️ Écriture supplémentaire
      </Link>
      <Link
        href="/gerant/comptabilite/rapprochement"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 8 }}
      >
        🏦 Rapprochement bancaire
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginRight: 6 }}>{c.numero}</span>
                      {renommageId === c.id ? (
                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <input
                            value={nomRenommage}
                            onChange={(e) => setNomRenommage(e.target.value)}
                            autoFocus
                            style={{ fontSize: 13, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                          />
                          <button onClick={(e) => sauvegarderRenommage(c.id, e)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>✓</button>
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRenommageId(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>✕</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13 }}>{c.nom}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{c.solde.toFixed(2)} $</span>
                      {estDeveloppeur && renommageId !== c.id && (
                        <button onClick={(e) => commencerRenommage(c, e)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>✏️</button>
                      )}
                      {c.nbEcritures === 0 && (
                        <button onClick={(e) => desactiverCompte(c.id, e)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>✕</button>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {comptesType.some((c) => c.id === renommageId) && erreurRenommage && (
              <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{erreurRenommage}</p>
            )}
          </div>
        );
      })}

      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 10 }}>
        Actif total : {totalActif.toFixed(2)} $ · Passif total : {totalPassif.toFixed(2)} $
      </p>
    </div>
  );
}
