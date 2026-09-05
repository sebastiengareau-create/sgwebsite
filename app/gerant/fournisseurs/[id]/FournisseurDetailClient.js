"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function FournisseurDetailClient({ fournisseur }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const [nom, setNom] = useState(fournisseur.nom);
  const [telephone, setTelephone] = useState(fournisseur.telephone || "");
  const [courriel, setCourriel] = useState(fournisseur.courriel || "");
  const [adresse, setAdresse] = useState(fournisseur.adresse || "");

  async function sauvegarder() {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/fournisseurs/${fournisseur.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setModeEdition(false);
    router.refresh();
  }

  async function toggleActif() {
    setEnCours(true);
    await fetch(`/api/fournisseurs/${fournisseur.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !fournisseur.actif }),
    });
    setEnCours(false);
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer définitivement le fournisseur "${fournisseur.nom}" ? Irréversible.`)) return;
    setEnCours(true);
    const res = await fetch(`/api/fournisseurs/${fournisseur.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    router.push("/gerant/fournisseurs");
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/fournisseurs" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux fournisseurs</Link>

      {/* Carte profil */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(180deg, var(--accent-clair), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#17150f", flexShrink: 0 }}>
            {fournisseur.nom.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{fournisseur.nom}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{fournisseur.courriel || "Aucun courriel"}</div>
          </div>
        </div>
        {!fournisseur.actif && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "var(--danger)", color: "white" }}>Désactivé</span>
          </div>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {modeEdition ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <SectionTitre>Coordonnées</SectionTitre>
          <label style={labelStyle}>Nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Téléphone</label>
          <input value={telephone} onChange={(e) => setTelephone(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Courriel</label>
          <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Adresse</label>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} style={{ ...champStyle, marginBottom: 12 }} />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <button onClick={() => setModeEdition(false)} className="bouton-3d-sombre" style={{ flex: 1, padding: 11, borderRadius: 10, fontSize: 13 }}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <SectionTitre>Coordonnées</SectionTitre>
            <Champ label="Téléphone" valeur={fournisseur.telephone} />
            <Champ label="Courriel" valeur={fournisseur.courriel} />
            <Champ label="Adresse" valeur={fournisseur.adresse} />
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <SectionTitre>Dépenses récentes ({fournisseur.depenses.length})</SectionTitre>
            {fournisseur.depenses.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucune dépense encore.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {fournisseur.depenses.map((d) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {new Date(d.dateFacture).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} — {d.description}
                    </span>
                    <span style={{ fontWeight: 600 }}>{d.montant.toFixed(2)} $</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setModeEdition(true)} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              ✏️ Modifier
            </button>
            <button onClick={toggleActif} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13, color: fournisseur.actif ? "var(--danger)" : "var(--success)" }}>
              {fournisseur.actif ? "Désactiver" : "Réactiver"}
            </button>
            <button onClick={supprimer} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13 }}>
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitre({ children }) {
  return <div style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 10 }}>{children}</div>;
}

function Champ({ label, valeur }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, gap: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{valeur || "—"}</span>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, marginTop: 8 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
