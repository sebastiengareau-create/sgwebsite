"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";

const ORDRE_TYPE = ["ACTIF", "PASSIF", "CAPITAUX_PROPRES", "REVENU", "DEPENSE"];
const COULEUR_TYPE = { ACTIF: "#4F82C0", PASSIF: "#C9A227", CAPITAUX_PROPRES: "#9C978A", REVENU: "#6FA96B", DEPENSE: "#C15B4A" };

const OUTILS = [
  { href: "/gerant/comptabilite/procedure", icone: "📋", label: "Procédure de fermeture" },
  { href: "/gerant/comptabilite/fermeture", icone: "🔒", label: "Fermeture de période" },
  { href: "/gerant/comptabilite/ouverture", icone: "📂", label: "Soldes d'ouverture" },
  { href: "/gerant/comptabilite/ecriture-manuelle", icone: "✍️", label: "Écriture supplémentaire" },
  { href: "/gerant/comptabilite/rapprochement", icone: "🏦", label: "Rapprochement bancaire" },
  { href: "/gerant/comptabilite/immobilisations", icone: "🏗️", label: "Immobilisations" },
  { href: "/gerant/comptabilite/remise-gouvernementale", icone: "🏛️", label: "Remise gouvernementale" },
  { href: "/gerant/comptabilite/rapports", icone: "📄", label: "Rapports imprimables" },
];

export default function PlanComptableClient({ comptes, labelsType, estDeveloppeur, periodeLabel }) {
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

  const typesPresents = ORDRE_TYPE.filter((t) => comptes.some((c) => c.type === t));
  const [ongletType, setOngletType] = useState(typesPresents[0] || "ACTIF");

  const totalActif = comptes.filter((c) => c.type === "ACTIF").reduce((s, c) => s + c.solde, 0);
  const totalPassif = comptes.filter((c) => c.type === "PASSIF").reduce((s, c) => s + c.solde, 0);
  const totalRevenu = comptes.filter((c) => c.type === "REVENU").reduce((s, c) => s + c.solde, 0);
  const totalDepense = comptes.filter((c) => c.type === "DEPENSE").reduce((s, c) => s + c.solde, 0);
  const profitNet = totalRevenu - totalDepense;

  const comptesOnglet = comptes.filter((c) => c.type === ongletType);

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

  async function basculerTypeCharge(compte, e) {
    e.preventDefault();
    e.stopPropagation();
    const nouveau = (compte.typeCharge || "FIXE") === "FIXE" ? "VARIABLE" : "FIXE";
    await fetch(`/api/comptabilite/comptes/${compte.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typeCharge: nouveau }),
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
      <BandeauSection icone="💰" titre="Comptabilité" sousTitre={`Période en cours : ${periodeLabel}`}>
        <Link href="/gerant/comptabilite/journal" style={{ display: "inline-block", marginTop: 12, fontSize: 12, fontWeight: 600, color: "#fff", textDecoration: "none", border: "1px solid rgba(255,255,255,0.3)", padding: "6px 12px", borderRadius: 8 }}>
          📖 Journal
        </Link>
      </BandeauSection>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>💰 Revenus totaux</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--success)" }}>{totalRevenu.toFixed(2)} $</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>📈 Profit net (à ce jour)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: profitNet >= 0 ? "var(--success)" : "var(--danger)" }}>{profitNet.toFixed(2)} $</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Link href="/gerant/comptabilite/etat-resultats" className="bouton-3d" style={{ flex: 1, textAlign: "center", padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          📊 État des résultats
        </Link>
        <Link href="/gerant/comptabilite/bilan" className="bouton-3d" style={{ flex: 1, textAlign: "center", padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          ⚖️ Bilan
        </Link>
      </div>

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: 8 }}>
        Outils
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
        {OUTILS.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="bouton-3d-sombre"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "12px 6px", borderRadius: 10, textDecoration: "none", textAlign: "center", minHeight: 74,
            }}
          >
            <span style={{ fontSize: 20 }}>{o.icone}</span>
            <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.2 }}>{o.label}</span>
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Plan comptable</div>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Les écritures se génèrent automatiquement à partir de tes factures.</p>
        </div>
        <button
          onClick={() => setAfficherFormulaire((v) => !v)}
          className="bouton-3d-sombre"
          style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
        >
          {afficherFormulaire ? "Annuler" : "+ Compte"}
        </button>
      </div>

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

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
        {typesPresents.map((t) => (
          <button
            key={t}
            onClick={() => setOngletType(t)}
            className={ongletType === t ? "bouton-3d" : "bouton-3d-sombre"}
            style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 10, whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {labelsType[t]}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: COULEUR_TYPE[ongletType], fontWeight: 700, marginBottom: 8 }}>
          {labelsType[ongletType]}
        </div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {comptesOnglet.map((c, i) => (
            <Link key={c.id} href={`/gerant/comptabilite/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{
                background: i % 2 === 0 ? "var(--surface)" : "var(--bg)",
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
                padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{c.solde.toFixed(2)} $</span>
                  {ongletType === "DEPENSE" && (
                    <button
                      onClick={(e) => basculerTypeCharge(c, e)}
                      title="Utilisé pour le seuil de rentabilité (Vue d'ensemble) — clique pour changer"
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, cursor: "pointer",
                        border: `1px solid ${(c.typeCharge || "FIXE") === "VARIABLE" ? "var(--accent)" : "var(--border)"}`,
                        background: (c.typeCharge || "FIXE") === "VARIABLE" ? "rgba(232,163,61,0.15)" : "var(--bg)",
                        color: (c.typeCharge || "FIXE") === "VARIABLE" ? "var(--accent)" : "var(--text-muted)",
                      }}
                    >
                      {(c.typeCharge || "FIXE") === "VARIABLE" ? "Variable" : "Fixe"}
                    </button>
                  )}
                  {estDeveloppeur && renommageId !== c.id && (
                    <button onClick={(e) => commencerRenommage(c, e)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: 4 }}>✏️</button>
                  )}
                  {c.nbEcritures === 0 && (
                    <button onClick={(e) => desactiverCompte(c.id, e)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: 4 }}>✕</button>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
        {comptesOnglet.some((c) => c.id === renommageId) && erreurRenommage && (
          <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{erreurRenommage}</p>
        )}
      </div>

      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 10 }}>
        Actif total : {totalActif.toFixed(2)} $ · Passif total : {totalPassif.toFixed(2)} $
      </p>
    </div>
  );
}
