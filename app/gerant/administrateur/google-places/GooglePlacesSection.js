"use client";

import { useState } from "react";

// Clé Google Places : suggestions d'adresses complètes dans les champs
// Adresse (clients, fournisseurs, employés…). Voir lib/googlePlaces.js.
export default function GooglePlacesSection({ configInitiale }) {
  const [config, setConfig] = useState(configInitiale);
  const [cle, setCle] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const actif = config.cleEnregistree || config.variable;

  async function envoyer(url, methode, corps, succes) {
    setEnCours(true);
    setErreur("");
    setMessage("");
    const res = await fetch(url, {
      method: methode,
      headers: { "Content-Type": "application/json" },
      body: corps ? JSON.stringify(corps) : undefined,
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) || {};
    setEnCours(false);
    if (!res?.ok) return setErreur(data.erreur || "Erreur de connexion.");
    if (data.cleEnregistree !== undefined) {
      setConfig(data);
      setCle("");
    }
    setMessage(typeof succes === "function" ? succes(data) : succes);
  }

  const champ = { padding: "7px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, minWidth: 0, flex: "1 1 180px" };

  return (
    <div className="conteneur-page-large" style={{ margin: "20px auto 0", padding: "0 16px" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Google Places — suggestions d'adresses</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Pendant qu'on tape une adresse (fiches clients, fournisseurs, employés, bons de travail…), l'appli propose les
          adresses réelles ; un clic remplit l'adresse, la ville, la province et le code postal. Sans clé, seules les villes
          sont suggérées (d'après le code postal et la liste des municipalités). La clé se crée dans Google Cloud Console
          (projet avec facturation, API « Places API (New) » activée) ; Google offre chaque mois un nombre de recherches
          gratuites avant de facturer.
        </p>
        {config.variable && !config.cleEnregistree && (
          <p style={{ fontSize: 12, color: "var(--success)", marginBottom: 12 }}>
            Une clé est fournie par l'installation (variable GOOGLE_PLACES_API_KEY) — une clé enregistrée ici la remplace.
          </p>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            value={cle}
            onChange={(e) => setCle(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder={config.cleEnregistree ? "Clé API enregistrée — en saisir une autre pour la remplacer" : "Clé API Google"}
            style={champ}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => envoyer("/api/parametres/google-places", "PUT", { cle }, "Enregistré ✓")} disabled={enCours || !cle.trim()} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            {enCours ? "…" : "Enregistrer"}
          </button>
          {actif && (
            <button
              onClick={() => envoyer("/api/parametres/google-places/tester", "POST", null, (d) => `Google répond ✓${d.exemple ? ` — ex. : ${d.exemple}` : ""}`)}
              disabled={enCours}
              className="bouton-3d-sombre"
              style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}
            >
              Tester
            </button>
          )}
          {config.cleEnregistree && (
            <button
              onClick={() => { if (window.confirm("Retirer la clé Google Places de l'appli ?")) envoyer("/api/parametres/google-places", "PUT", { effacer: true }, "Clé retirée."); }}
              disabled={enCours}
              style={{ fontSize: 12, color: "var(--danger)", background: "none", border: "none", cursor: "pointer" }}
            >
              Retirer
            </button>
          )}
          {message && <span style={{ fontSize: 12, color: "var(--success)" }}>{message}</span>}
          {erreur && <span style={{ fontSize: 12, color: "var(--danger)" }}>{erreur}</span>}
        </div>
      </div>
    </div>
  );
}
