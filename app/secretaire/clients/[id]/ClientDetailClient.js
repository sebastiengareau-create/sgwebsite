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
      <button onClick={() => router.push("/secretaire/clients")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", marginBottom: 12 }}>
        ← Retour aux clients
      </button>

      {modeEdition ? (
        <form onSubmit={sauvegarder} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
          <input required placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
          <input placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} style={champStyle} />
          <input placeholder="Courriel" type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
          <input placeholder="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} style={champStyle} />
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Ville" value={ville} onChange={(e) => setVille(e.target.value)} style={{ ...champStyle, flex: 1 }} />
            <input placeholder="Code postal" value={codePostal} onChange={(e) => setCodePostal(e.target.value.toUpperCase())} maxLength={7} style={{ ...champStyle, width: 110 }} />
          </div>
          <input placeholder="Garantie prolongée — numéro de contrat" value={garantieProlongee} onChange={(e) => setGarantieProlongee(e.target.value)} style={champStyle} />
          {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 4 }}>{erreur}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="submit" disabled={enCours} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, cursor: "pointer" }}>
              {enCours ? "Sauvegarde…" : "Sauvegarder"}
            </button>
            <button type="button" onClick={() => setModeEdition(false)} style={{ padding: "0 14px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>{client.nom}</h1>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
              {[client.telephone, client.courriel].filter(Boolean).join(" · ") || "Aucune coordonnée"}
            </div>
            {(client.adresse || client.ville) && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {[client.adresse, [client.ville, client.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
              </div>
            )}
            {client.garantieProlongee && (
              <div style={{ fontSize: 12, marginTop: 8, padding: "4px 8px", background: "var(--bg)", borderRadius: 6, display: "inline-block" }}>
                🛡️ Garantie prolongée — #{client.garantieProlongee}
              </div>
            )}
            {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setModeEdition(true)} style={boutonSecondaire}>Modifier</button>
              <button onClick={supprimer} disabled={enCours} style={{ ...boutonSecondaire, flex: "0 0 auto", padding: "8px 10px" }}>🗑️</button>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Bons de commande ({client.bons.length})</h2>
            {client.bons.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun bon encore.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {client.bons.map((b) => (
                  <Link key={b.id} href={`/bons/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between" }}>
                      <span><strong style={{ fontSize: 14, fontFamily: "monospace" }}>#{b.numero}</strong></span>
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{STATUTS_BON[b.statut]}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {client.soumissions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Soumissions ({client.soumissions.length})</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {client.soumissions.map((s) => (
                  <Link key={s.id} href={`/secretaire/operations/soumissions/${s.id}/modifier`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>#{s.numero}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{STATUTS_SOUMISSION[s.statut] || s.statut}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const boutonSecondaire = {
  flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "none",
  color: "var(--text-muted)", cursor: "pointer", fontSize: 11.5, fontWeight: 600,
};
