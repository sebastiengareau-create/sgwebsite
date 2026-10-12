"use client";

import { useState } from "react";

// Compte PartsTech du garage : « 🔌 Chercher dans PartsTech » des commandes
// de pièces en brouillon. Voir lib/partstech.js.
export default function PartsTechSection({ configInitiale }) {
  const [config, setConfig] = useState(configInitiale);
  const [utilisateur, setUtilisateur] = useState(configInitiale.utilisateur);
  const [cle, setCle] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

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
    if (data.utilisateur !== undefined) {
      setConfig(data);
      setUtilisateur(data.utilisateur);
      setCle("");
    }
    setMessage(succes);
  }

  const champ = { padding: "7px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, minWidth: 0, flex: "1 1 180px" };

  return (
    <div className="conteneur-page-large" style={{ margin: "20px auto 0", padding: "0 16px" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>PartsTech</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Compare les prix et le stock de tes fournisseurs branchés à PartsTech, depuis une commande de pièces en brouillon
          (« 🔌 Chercher dans PartsTech ») : le panier soumis revient dans la commande. L'utilisateur et la clé API se trouvent
          dans ton compte PartsTech (Account → API) — la clé n'est pas ton mot de passe.
        </p>
        {!config.partenaire && (
          <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 12 }}>
            Cette installation n'a pas encore d'identifiants partenaire PartsTech (variables PARTSTECH_PARTNER_ID et PARTSTECH_PARTNER_KEY) — la recherche ne sera pas offerte.
          </p>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <input value={utilisateur} onChange={(e) => setUtilisateur(e.target.value)} placeholder="Utilisateur PartsTech" autoComplete="off" style={champ} />
          <input
            value={cle}
            onChange={(e) => setCle(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder={config.cleEnregistree ? "Clé API enregistrée — laisser vide pour la garder" : "Clé API PartsTech"}
            style={champ}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => envoyer("/api/parametres/partstech", "PUT", { utilisateur, cle }, "Enregistré ✓")} disabled={enCours} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            {enCours ? "…" : "Enregistrer"}
          </button>
          {config.actif && (
            <button onClick={() => envoyer("/api/parametres/partstech/tester", "POST", null, "Connexion à PartsTech réussie ✓")} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
              Tester la connexion
            </button>
          )}
          {(config.utilisateur || config.cleEnregistree) && (
            <button
              onClick={() => { if (window.confirm("Retirer le compte PartsTech de l'appli ?")) envoyer("/api/parametres/partstech", "PUT", { effacer: true }, "Compte retiré."); }}
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
