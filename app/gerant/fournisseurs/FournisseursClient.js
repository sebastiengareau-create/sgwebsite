"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function FournisseursClient({ fournisseurs }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [recherche, setRecherche] = useState("");

  const fournisseursFiltres = fournisseurs.filter((f) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    const champs = [f.nom, f.telephone, f.courriel, f.adresse];
    return champs.some((champ) => champ && champ.toLowerCase().includes(q));
  });

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>Fournisseurs</h1>
        <button
          onClick={() => setAfficherFormulaire((v) => !v)}
          className="bouton-3d"
          style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}
        >
          {afficherFormulaire ? "Annuler" : "+ Nouveau fournisseur"}
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
        Touche un fournisseur pour voir sa fiche complète — coordonnées, historique de dépenses.
      </p>
      <Link
        href="/gerant/comptabilite/comptes-a-payer"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 16 }}
      >
        💳 Comptes à payer / Dépenses
      </Link>

      {afficherFormulaire && (
        <FormulaireCreation onCree={() => { setAfficherFormulaire(false); router.refresh(); }} />
      )}

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher par nom, téléphone, courriel…"
        style={{
          width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--text)", fontSize: 13, marginTop: 12, marginBottom: 16, boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {fournisseursFiltres.map((f) => (
          <Link key={f.id} href={`/gerant/fournisseurs/${f.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="bouton-3d-sombre" style={{ borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12, opacity: f.actif ? 1 : 0.5 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(180deg, var(--accent-clair), var(--accent))",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#17150f",
              }}>
                {f.nom.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{f.nom}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[f.telephone, f.courriel, f.adresse].filter(Boolean).join(" · ") || "Aucune coordonnée"}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{f._count.depenses} dépense{f._count.depenses !== 1 ? "s" : ""}</span>
                {!f.actif && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--danger)" }}>Désactivé</span>}
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: 16 }}>›</span>
            </div>
          </Link>
        ))}
        {fournisseursFiltres.length === 0 && fournisseurs.length > 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun fournisseur ne correspond à "{recherche}".</p>
        )}
        {fournisseurs.length === 0 && !afficherFormulaire && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun fournisseur encore — ajoute-en un avec "+ Nouveau fournisseur".</p>
        )}
      </div>
    </div>
  );
}

function FormulaireCreation({ onCree }) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [courriel, setCourriel] = useState("");
  const [adresse, setAdresse] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/fournisseurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    onCree();
  }

  return (
    <form onSubmit={creer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 4 }}>
      <input required placeholder="Nom du fournisseur" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <input placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} style={champStyle} />
      <input placeholder="Courriel" type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
      <input placeholder="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
        {enCours ? "Création…" : "Créer le fournisseur"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
