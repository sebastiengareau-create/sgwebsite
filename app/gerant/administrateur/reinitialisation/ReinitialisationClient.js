"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function CarteReinitialisation({ titre, description, phrase, inclureConfiguration, avertissementExtra }) {
  const router = useRouter();
  const [phraseConfirmation, setPhraseConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function executer() {
    if (phraseConfirmation !== phrase) {
      setMessage({ type: "erreur", texte: `Tape exactement ${phrase} pour confirmer.` });
      return;
    }
    if (!window.confirm("Dernière confirmation : cette action efface des données réelles et est irréversible. Continuer ?")) return;
    if (!window.confirm("Vraiment sûr ? Il n'y a pas de retour en arrière possible après ça.")) return;

    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/administrateur/reinitialisation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: phraseConfirmation, inclureConfiguration }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setMessage({ type: "erreur", texte: data.erreur || "Échec de la réinitialisation." });
      return;
    }
    setMessage({ type: "succes", texte: "Réinitialisation réussie ✓" });
    setPhraseConfirmation("");
    router.refresh();
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--danger)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--danger)" }}>{titre}</div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{description}</p>
      {avertissementExtra && (
        <p style={{ fontSize: 11.5, color: "var(--accent)", marginBottom: 8 }}>⚠️ {avertissementExtra}</p>
      )}

      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
        Tape <strong style={{ color: "var(--danger)" }}>{phrase}</strong> pour confirmer :
      </label>
      <input
        value={phraseConfirmation}
        onChange={(e) => setPhraseConfirmation(e.target.value)}
        placeholder={phrase}
        style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--danger)", background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }}
      />

      {message && (
        <p style={{ fontSize: 12, color: message.type === "succes" ? "var(--success)" : "var(--danger)", marginBottom: 10 }}>
          {message.texte}
        </p>
      )}

      <button
        onClick={executer}
        disabled={phraseConfirmation !== phrase || enCours}
        style={{
          width: "100%", padding: 12, borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13,
          background: phraseConfirmation === phrase ? "var(--danger)" : "#3a2620",
          color: phraseConfirmation === phrase ? "white" : "var(--text-muted)",
          cursor: phraseConfirmation === phrase ? "pointer" : "not-allowed",
        }}
      >
        {enCours ? "Réinitialisation en cours…" : titre}
      </button>
    </div>
  );
}

export default function ReinitialisationClient() {
  return (
    <div className="conteneur-page">
      <Link href="/gerant/administrateur" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Administrateur</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>🧨 Réinitialisation</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
        Efface des données réelles pour repartir à 0 — pense à faire une sauvegarde d'abord si tu n'es pas certain.
        Visible seulement par toi.
      </p>

      <CarteReinitialisation
        titre="Effacer seulement les données transactionnelles"
        description="Vide bons, factures, clients, paie, journal, fournisseurs, dépenses, immobilisations, etc. Garde intacts les Paramètres (nom d'entreprise, taux, taxes, horaire) et les comptes employés existants."
        phrase="EFFACER DONNEES"
        inclureConfiguration={false}
      />

      <CarteReinitialisation
        titre="Tout effacer, y compris Paramètres et Utilisateurs"
        description="Repart à 0 complet, comme une toute nouvelle installation — idéal pour préparer le template avant de le revendre à un nouveau client."
        phrase="EFFACER TOUT"
        inclureConfiguration={true}
        avertissementExtra="Ton compte Développeur reste toujours accessible après (il n'est jamais lié à un compte employé), mais il faudra recréer les employés et reconfigurer les Paramètres."
      />
    </div>
  );
}
