"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = [
  { valeur: "CAISSE", label: "Caisse" },
  { valeur: "BANQUE", label: "Banque" },
  { valeur: "CARTE_CREDIT", label: "Carte de crédit" },
];
const LABEL_CATEGORIE = Object.fromEntries(CATEGORIES.map((c) => [c.valeur, c.label]));

export default function ComptesClient({ comptes, comptesGlDisponibles }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);

  const parCategorie = CATEGORIES.map((cat) => ({
    ...cat,
    comptes: comptes.filter((c) => c.categorie === cat.valeur),
  }));

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite/caisse-banque" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Caisse & Banque</Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 4px" }}>
        <h1 style={{ fontSize: 20 }}>🏦 Comptes</h1>
        <button onClick={() => setAfficherFormulaire((v) => !v)} className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {afficherFormulaire ? "Annuler" : "+ Compte"}
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 16 }}>
        Chaque compte est relié à un compte du plan comptable — les écritures et le solde comptable ne changent pas, ceci sert juste à regrouper et suivre tes comptes réels.
      </p>

      {afficherFormulaire && (
        <FormulaireCompte
          comptesGlDisponibles={comptesGlDisponibles}
          onCree={() => { setAfficherFormulaire(false); router.refresh(); }}
        />
      )}

      {parCategorie.map((cat) => (
        <div key={cat.valeur} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, marginBottom: 8 }}>{cat.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cat.comptes.map((c) => <LigneCompte key={c.id} compte={c} onModifie={() => router.refresh()} />)}
            {cat.comptes.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Aucun compte dans cette catégorie.</p>}
          </div>
        </div>
      ))}

      <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 8 }}>
        La conciliation détaillée par compte (« Dernière conciliation ») arrive dans une prochaine étape.
      </p>
    </div>
  );
}

function LigneCompte({ compte, onModifie }) {
  const [soldeReleve, setSoldeReleve] = useState(compte.soldeReleve.toFixed(2));
  const [enCours, setEnCours] = useState(false);

  async function sauvegarderSolde() {
    setEnCours(true);
    await fetch(`/api/comptabilite/tresorerie/comptes/${compte.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldeReleve }),
    });
    setEnCours(false);
    onModifie();
  }

  async function basculerActif() {
    if (compte.actif && !window.confirm(`Retirer "${compte.nom}" de la liste ? Son historique reste intact.`)) return;
    await fetch(`/api/comptabilite/tresorerie/comptes/${compte.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !compte.actif }),
    });
    onModifie();
  }

  const ecart = Number(soldeReleve) - compte.soldeComptable;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, opacity: compte.actif ? 1 : 0.55 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{compte.nom}{!compte.actif && " (inactif)"}</div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "monospace" }}>{compte.compteNumero} — {compte.compteNom}</div>
        </div>
        <button onClick={basculerActif} style={{ background: "none", border: "none", color: compte.actif ? "var(--danger)" : "var(--accent)", cursor: "pointer", fontSize: 12 }}>
          {compte.actif ? "✕" : "↺"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        <Champ label="Solde comptable" valeur={`${compte.soldeComptable.toFixed(2)} $`} />
        <div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Solde relevé</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="number" step="0.01" value={soldeReleve} onChange={(e) => setSoldeReleve(e.target.value)}
              style={{ width: 90, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12.5 }}
            />
            <button onClick={sauvegarderSolde} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
              ✓
            </button>
          </div>
        </div>
        <Champ label="Écart" valeur={`${ecart.toFixed(2)} $`} couleur={Math.abs(ecart) < 0.01 ? "var(--success)" : "var(--danger)"} />
      </div>
    </div>
  );
}

function Champ({ label, valeur, couleur }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: couleur || "var(--text)" }}>{valeur}</div>
    </div>
  );
}

function FormulaireCompte({ comptesGlDisponibles, onCree }) {
  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("CAISSE");
  const [modeCompte, setModeCompte] = useState("nouveau"); // "nouveau" | "existant"
  const [compteNumero, setCompteNumero] = useState(comptesGlDisponibles[0]?.numero || "");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    if (!nom.trim()) { setErreur("Nom requis."); return; }
    setEnCours(true);
    const res = await fetch("/api/comptabilite/tresorerie/comptes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        modeCompte === "existant" ? { nom, categorie, compteNumero } : { nom, categorie }
      ),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    onCree();
  }

  return (
    <form onSubmit={creer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <label style={labelStyle}>Nom du compte</label>
      <input placeholder="Ex : Petite caisse" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />

      <label style={labelStyle}>Catégorie</label>
      <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={champStyle}>
        {CATEGORIES.map((c) => <option key={c.valeur} value={c.valeur}>{c.label}</option>)}
      </select>

      <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 3, marginBottom: 8 }}>
        <button type="button" onClick={() => setModeCompte("nouveau")} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: modeCompte === "nouveau" ? "var(--accent)" : "none", color: modeCompte === "nouveau" ? "#17150f" : "var(--text-muted)" }}>
          + Nouveau compte GL
        </button>
        <button type="button" onClick={() => setModeCompte("existant")} disabled={comptesGlDisponibles.length === 0} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 6, border: "none", cursor: comptesGlDisponibles.length === 0 ? "default" : "pointer", background: modeCompte === "existant" ? "var(--accent)" : "none", color: modeCompte === "existant" ? "#17150f" : "var(--text-muted)", opacity: comptesGlDisponibles.length === 0 ? 0.5 : 1 }}>
          Compte GL existant
        </button>
      </div>

      {modeCompte === "nouveau" ? (
        <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "0 0 8px" }}>Un compte "{nom || "…"}" sera créé automatiquement dans le plan comptable.</p>
      ) : (
        <select value={compteNumero} onChange={(e) => setCompteNumero(e.target.value)} style={champStyle}>
          {comptesGlDisponibles.map((c) => <option key={c.id} value={c.numero}>{c.numero} — {c.nom}</option>)}
        </select>
      )}

      {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
        {enCours ? "…" : "Créer le compte"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 };
