"use client";

import { useState } from "react";

// « 📧 Courriel » : envoie un document (soumission, bon) au client en PDF
// joint. Ouvre une ligne avec son courriel au dossier (modifiable) et
// « Envoyer ». À placer dans une rangée flex qui passe à la ligne
// (flexWrap) : la ligne d'envoi prend toute la largeur en dessous.
// url : route POST qui reçoit { courrielManuel }.
export default function BoutonEnvoiCourriel({ url, courrielDefaut = "", libelle = "📧 Courriel", style }) {
  const [ouvert, setOuvert] = useState(false);
  const [courriel, setCourriel] = useState(courrielDefaut || "");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null); // { texte, erreur }

  async function envoyer(e) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courrielManuel: courriel.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setMessage({ texte: data.erreur || "Erreur lors de l'envoi.", erreur: true });
      return;
    }
    setOuvert(false);
    setMessage({ texte: `Envoyé à ${data.destinataire} ✓` });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setMessage(null); setOuvert(!ouvert); }}
        title="Envoyer au client par courriel (PDF joint)"
        style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", background: "none", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: 8, cursor: "pointer", ...style }}
      >
        {libelle}
      </button>
      {(ouvert || message) && (
        <div style={{ flexBasis: "100%", width: "100%" }}>
          {ouvert && (
            // Pas un <form> : le bouton peut se trouver dans un formulaire
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="email" placeholder="courriel@client.com" value={courriel}
                onChange={(e) => setCourriel(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key !== "Enter") return; e.preventDefault(); if (courriel.trim() && !enCours) envoyer(e); }}
                style={{ flex: 1, minWidth: 0, padding: "8px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
              />
              <button type="button" onClick={envoyer} disabled={!courriel.trim() || enCours} className="bouton-3d" style={{ padding: "0 14px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                {enCours ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          )}
          {message && (
            <p style={{ fontSize: 12, margin: "6px 0 0", color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>
          )}
        </div>
      )}
    </>
  );
}
