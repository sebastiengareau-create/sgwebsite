"use client";

import { useState, useRef } from "react";
import Link from "next/link";

export default function SauvegardeClient({ peutRestaurer, courrielAutoInit }) {
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [fichierChoisi, setFichierChoisi] = useState(null);
  const [phraseConfirmation, setPhraseConfirmation] = useState("");
  const [restaurationEnCours, setRestaurationEnCours] = useState(false);
  const [message, setMessage] = useState(null); // { type: "succes"|"erreur", texte }
  const inputFichierRef = useRef(null);

  const [courrielAuto, setCourrielAuto] = useState(courrielAutoInit || "");
  const [courrielAutoEnCours, setCourrielAutoEnCours] = useState(false);
  const [messageCourrielAuto, setMessageCourrielAuto] = useState(null);

  async function sauvegarderCourrielAuto() {
    setCourrielAutoEnCours(true);
    setMessageCourrielAuto(null);
    const res = await fetch("/api/administrateur/sauvegarde-auto", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courriel: courrielAuto }),
    });
    setCourrielAutoEnCours(false);
    if (!res.ok) {
      setMessageCourrielAuto({ type: "erreur", texte: "Erreur lors de la sauvegarde." });
      return;
    }
    const data = await res.json();
    setCourrielAuto(data.courriel);
    setMessageCourrielAuto({
      type: "succes",
      texte: data.courriel ? "Sauvegarde automatique activée ✓" : "Sauvegarde automatique désactivée — le téléchargement manuel reste disponible.",
    });
  }

  async function telecharger() {
    setTelechargementEnCours(true);
    const res = await fetch("/api/sauvegarde/exporter");
    setTelechargementEnCours(false);
    if (!res.ok) {
      setMessage({ type: "erreur", texte: "Échec du téléchargement." });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restaurer() {
    if (!fichierChoisi) return;
    if (phraseConfirmation !== "RESTAURER") {
      setMessage({ type: "erreur", texte: "Tape exactement RESTAURER pour confirmer." });
      return;
    }
    if (!window.confirm("Dernière confirmation : TOUTES les données actuelles seront effacées et remplacées par celles du fichier. Continuer ?")) return;
    if (!window.confirm("Vraiment sûr ? Il n'y a pas de retour en arrière possible après ça.")) return;

    setRestaurationEnCours(true);
    setMessage(null);
    try {
      const texte = await fichierChoisi.text();
      const donnees = JSON.parse(texte);
      const res = await fetch("/api/sauvegarde/importer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donnees, confirmation: "RESTAURER" }),
      });
      const data = await res.json();
      setRestaurationEnCours(false);
      if (!res.ok) {
        setMessage({ type: "erreur", texte: data.erreur || "Échec de la restauration." });
        return;
      }
      setMessage({ type: "succes", texte: "Restauration réussie ✓ — toutes les données ont été remplacées." });
      setFichierChoisi(null);
      setPhraseConfirmation("");
      if (inputFichierRef.current) inputFichierRef.current.value = "";
    } catch (e) {
      setRestaurationEnCours(false);
      setMessage({ type: "erreur", texte: "Fichier invalide ou illisible : " + e.message });
    }
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/parametres" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Paramètres</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>💾 Sauvegarde</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
        Toutes les données de l'installation (clients, bons, factures, comptabilité, etc.) dans un seul fichier
        téléchargeable — garde-le où tu veux (ton ordinateur, Google Drive, Dropbox…).
      </p>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Télécharger une sauvegarde</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Crée un fichier .json avec absolument tout, à l'instant présent. Recommandé régulièrement, et surtout avant
          tout changement important.
        </p>
        <button
          onClick={telecharger}
          disabled={telechargementEnCours}
          className="bouton-3d"
          style={{ width: "100%", padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 700 }}
        >
          {telechargementEnCours ? "Préparation…" : "⬇️ Télécharger la sauvegarde"}
        </button>
      </div>

      {peutRestaurer && (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📧 Sauvegarde automatique quotidienne</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Le serveur n'a pas d'espace de stockage permanent où choisir un chemin — la sauvegarde du jour t'est plutôt
          envoyée par courriel automatiquement, une fois par jour. Laisse le champ vide pour désactiver et garder
          seulement le téléchargement manuel ci-dessus.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            value={courrielAuto}
            onChange={(e) => setCourrielAuto(e.target.value)}
            placeholder="courriel@exemple.com"
            style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }}
          />
          <button
            onClick={sauvegarderCourrielAuto}
            disabled={courrielAutoEnCours}
            className="bouton-3d"
            style={{ padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
          >
            {courrielAutoEnCours ? "…" : "✓ Enregistrer"}
          </button>
        </div>
        {messageCourrielAuto && (
          <p style={{ fontSize: 12, color: messageCourrielAuto.type === "succes" ? "var(--success)" : "var(--danger)", marginTop: 8 }}>
            {messageCourrielAuto.texte}
          </p>
        )}
      </div>
      )}

      {peutRestaurer && (
      <div style={{ background: "var(--surface)", border: "1px solid var(--danger)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--danger)" }}>⚠️ Restaurer une sauvegarde</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Efface TOUTES les données actuelles et les remplace par celles du fichier choisi. Irréversible — à utiliser
          seulement en cas de vrai problème (perte de données, migration vers une nouvelle installation).
        </p>

        <input
          ref={inputFichierRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => setFichierChoisi(e.target.files?.[0] || null)}
          style={{ width: "100%", marginBottom: 10, fontSize: 12, color: "var(--text-muted)" }}
        />

        {fichierChoisi && (
          <>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Tape <strong style={{ color: "var(--danger)" }}>RESTAURER</strong> pour confirmer :
            </label>
            <input
              value={phraseConfirmation}
              onChange={(e) => setPhraseConfirmation(e.target.value)}
              placeholder="RESTAURER"
              style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--danger)", background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }}
            />
          </>
        )}

        {message && (
          <p style={{ fontSize: 12, color: message.type === "succes" ? "var(--success)" : "var(--danger)", marginBottom: 10 }}>
            {message.texte}
          </p>
        )}

        <button
          onClick={restaurer}
          disabled={!fichierChoisi || phraseConfirmation !== "RESTAURER" || restaurationEnCours}
          style={{
            width: "100%", padding: 12, borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13,
            background: fichierChoisi && phraseConfirmation === "RESTAURER" ? "var(--danger)" : "#3a2620",
            color: fichierChoisi && phraseConfirmation === "RESTAURER" ? "white" : "var(--text-muted)",
            cursor: fichierChoisi && phraseConfirmation === "RESTAURER" ? "pointer" : "not-allowed",
          }}
        >
          {restaurationEnCours ? "Restauration en cours…" : "Restaurer (efface tout d'abord)"}
        </button>
      </div>
      )}
    </div>
  );
}
