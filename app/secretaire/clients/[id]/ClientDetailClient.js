"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUTS_BON = { EN_ATTENTE: "En attente", EN_COURS: "En cours", TERMINE: "Facturé" };
const STATUTS_SOUMISSION = { BROUILLON: "En attente", EN_ATTENTE: "En attente", ENVOYEE: "En attente", ACCEPTEE: "Acceptée", REFUSEE: "Refusée" };

export default function ClientDetailClient({ client }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const [nom, setNom] = useState(client.nom);
  const [telephone, setTelephone] = useState(client.telephone || "");
  const [courriel, setCourriel] = useState(client.courriel || "");
  const [adresse, setAdresse] = useState(client.adresse || "");
  const [ville, setVille] = useState(client.ville || "");
  const [codePostal, setCodePostal] = useState(client.codePostal || "");
  const [garantieProlongee, setGarantieProlongee] = useState(client.garantieProlongee || "");

  async function sauvegarder(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse, ville, codePostal, garantieProlongee }),
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

  async function supprimer() {
    if (!window.confirm(`Supprimer le client "${client.nom}" ? Impossible si des bons de travail lui sont associés.`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.push("/secretaire/clients");
  }

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/clients" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux clients</Link>

      {/* Carte profil */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(180deg, var(--accent-clair), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#17150f", flexShrink: 0 }}>
            {client.nom.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{client.nom}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {client.numero && <span style={{ fontFamily: "monospace", fontWeight: 700, marginRight: 6 }}>#{client.numero}</span>}
              {client.courriel || "Aucun courriel"}
            </div>
          </div>
        </div>
        {client.garantieProlongee && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <span className="bouton-3d" style={{ display: "inline-block", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              🛡️ Garantie prolongée — #{client.garantieProlongee}
            </span>
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
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} style={champStyle} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Ville</label>
              <input value={ville} onChange={(e) => setVille(e.target.value)} style={champStyle} />
            </div>
            <div style={{ width: 110 }}>
              <label style={labelStyle}>Code postal</label>
              <input value={codePostal} onChange={(e) => setCodePostal(e.target.value.toUpperCase())} maxLength={7} style={champStyle} />
            </div>
          </div>
          <label style={labelStyle}>Garantie prolongée — numéro de contrat</label>
          <input value={garantieProlongee} onChange={(e) => setGarantieProlongee(e.target.value)} style={{ ...champStyle, marginBottom: 12 }} />

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
            <Champ label="Téléphone" valeur={client.telephone} />
            <Champ label="Adresse" valeur={client.adresse} />
            <Champ label="Ville" valeur={[client.ville, client.codePostal].filter(Boolean).join(" ") || null} />
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <SectionTitre>Bons de commande ({client.bons.length})</SectionTitre>
            {client.bons.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun bon encore.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {client.bons.map((b) => (
                  <Link key={b.id} href={`/bons/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: 13, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between" }}>
                      <span><strong style={{ fontSize: 14, fontFamily: "monospace" }}>#{b.numero}</strong></span>
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{STATUTS_BON[b.statut]}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {client.soumissions.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <SectionTitre>Soumissions ({client.soumissions.length})</SectionTitre>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {client.soumissions.map((s) => (
                  <Link key={s.id} href={`/secretaire/operations/soumissions/${s.id}/modifier`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: 13, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>#{s.numero}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{STATUTS_SOUMISSION[s.statut] || s.statut}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setModeEdition(true)} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              ✏️ Modifier
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
