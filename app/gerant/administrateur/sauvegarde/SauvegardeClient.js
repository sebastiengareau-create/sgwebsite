"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { nombre } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { TEINTES, TitrePanneau, stylePanneau, Pastille } from "../../../components/StyleSection";

// Lit le fichier choisi : .json, ou .json.gz (sauvegarde automatique reçue
// par courriel, compressée)
async function lireFichierSauvegarde(fichier) {
  const debut = new Uint8Array(await fichier.slice(0, 2).arrayBuffer());
  if (debut[0] === 0x1f && debut[1] === 0x8b) {
    const flux = fichier.stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(flux).text();
  }
  return await fichier.text();
}

function formaterMoment(iso) {
  return new Date(iso).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" });
}

export default function SauvegardeClient({ peutRestaurer, courrielAutoInit, dernierResultatInit }) {
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [fichierChoisi, setFichierChoisi] = useState(null);
  const [phraseConfirmation, setPhraseConfirmation] = useState("");
  const [restaurationEnCours, setRestaurationEnCours] = useState(false);
  const [message, setMessage] = useState(null); // { type: "succes"|"erreur", texte }
  const [messageTelechargement, setMessageTelechargement] = useState(null);
  const inputFichierRef = useRef(null);

  const [courrielAuto, setCourrielAuto] = useState(courrielAutoInit || "");
  const [courrielAutoEnCours, setCourrielAutoEnCours] = useState(false);
  const [messageCourrielAuto, setMessageCourrielAuto] = useState(null);
  const [courrielEnregistre, setCourrielEnregistre] = useState((courrielAutoInit || "").trim());
  const [dernierResultat, setDernierResultat] = useState(dernierResultatInit || null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function envoyerMaintenant() {
    setEnvoiEnCours(true);
    try {
      const res = await fetch("/api/administrateur/sauvegarde-auto", { method: "POST" });
      const data = await res.json();
      setDernierResultat(res.ok ? data : { le: new Date().toISOString(), ok: false, message: data.erreur || "Échec de l'envoi." });
    } catch (e) {
      setDernierResultat({ le: new Date().toISOString(), ok: false, message: `Échec de l'envoi (${e.message}).` });
    } finally {
      setEnvoiEnCours(false);
    }
  }

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
    setCourrielEnregistre(data.courriel);
    setMessageCourrielAuto({
      type: "succes",
      texte: data.courriel ? "Sauvegarde automatique activée ✓" : "Sauvegarde automatique désactivée — le téléchargement manuel reste disponible.",
    });
  }

  async function telecharger() {
    setTelechargementEnCours(true);
    setMessageTelechargement(null);
    try {
      const res = await fetch("/api/sauvegarde/exporter");
      if (!res.ok) throw new Error(`le serveur a répondu ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      // Libéré plus tard : Safari (iPhone) annule le téléchargement si le lien disparaît tout de suite
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessageTelechargement({ type: "succes", texte: `Sauvegarde téléchargée ✓ (${nombre((blob.size / 1048576), 1)} Mo)` });
    } catch (e) {
      setMessageTelechargement({ type: "erreur", texte: `Échec du téléchargement (${e.message}). Réessaie, idéalement depuis un ordinateur.` });
    } finally {
      setTelechargementEnCours(false);
    }
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
      const texte = await lireFichierSauvegarde(fichierChoisi);
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
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="💾" titre="Sauvegarde des données" sousTitre="Toutes les données de l'installation dans un seul fichier — garde-le où tu veux (ordinateur, Google Drive, Dropbox…)." />
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="boite" teinte={TEINTES.bleu} titre="Télécharger une sauvegarde" sousTitre="Clients, bons, factures, comptabilité… et les photos" />
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
          Crée un fichier .json avec absolument tout, à l'instant présent. Recommandé régulièrement, et surtout avant
          tout changement important.
        </p>
        <button
          onClick={telecharger}
          disabled={telechargementEnCours}
          style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: "var(--accent)", color: "#221f18", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >
          {telechargementEnCours ? "Préparation…" : "⬇️ Télécharger la sauvegarde"}
        </button>
        {telechargementEnCours && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            Le fichier contient tout, photos comprises : ça peut prendre quelques minutes.
          </p>
        )}
        {messageTelechargement && (
          <p style={{ fontSize: 12, color: messageTelechargement.type === "succes" ? "var(--success)" : "var(--danger)", marginTop: 8 }}>
            {messageTelechargement.texte}
          </p>
        )}
      </div>

      {peutRestaurer && (
      <div style={stylePanneau}>
        <TitrePanneau
          icone="horloge" teinte={TEINTES.vert} titre="Sauvegarde automatique quotidienne" sousTitre="Envoyée par courriel une fois par jour"
          droite={courrielEnregistre ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Active</Pastille> : <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Désactivée</Pastille>}
        />
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
          Le serveur n'a pas d'espace de stockage permanent où choisir un chemin — la sauvegarde du jour t'est plutôt
          envoyée par courriel automatiquement, une fois par jour. Elle contient toutes les données{" "}
          <strong>sauf les photos des bons</strong>, trop lourdes pour un courriel : pour une copie avec les photos,
          utilise le téléchargement ci-dessus. Laisse le champ vide pour désactiver et garder seulement le
          téléchargement manuel.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            value={courrielAuto}
            onChange={(e) => setCourrielAuto(e.target.value)}
            placeholder="courriel@exemple.com"
            style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box" }}
          />
          <button
            onClick={sauvegarderCourrielAuto}
            disabled={courrielAutoEnCours}
            style={{ padding: "0 16px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#221f18", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {courrielAutoEnCours ? "…" : "✓ Enregistrer"}
          </button>
        </div>
        {messageCourrielAuto && (
          <p style={{ fontSize: 12, color: messageCourrielAuto.type === "succes" ? "var(--success)" : "var(--danger)", marginTop: 8 }}>
            {messageCourrielAuto.texte}
          </p>
        )}
        {courrielEnregistre ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            {dernierResultat ? (
              <p style={{ fontSize: 12, color: dernierResultat.ok ? "var(--success)" : "var(--danger)", marginBottom: 8 }}>
                {dernierResultat.ok ? "✓" : "⚠️"} Dernier envoi, {formaterMoment(dernierResultat.le)} : {dernierResultat.message}
              </p>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Aucun envoi enregistré pour l'instant.</p>
            )}
            <button
              onClick={envoyerMaintenant}
              disabled={envoiEnCours}
              style={{ width: "100%", padding: 11, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {envoiEnCours ? "Envoi en cours… (peut prendre une minute)" : "📤 Envoyer la sauvegarde maintenant"}
            </button>
          </div>
        ) : null}
      </div>
      )}

      {peutRestaurer && (
      <div style={{ ...stylePanneau, position: "relative", overflow: "hidden", border: "1px solid var(--danger)", paddingLeft: 22 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "var(--danger)" }} />
        <TitrePanneau icone="alerte" teinte={TEINTES.rouge} titre="Restaurer une sauvegarde" sousTitre="Zone sensible — efface tout d'abord" />
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
          Efface TOUTES les données actuelles et les remplace par celles du fichier choisi. Irréversible — à utiliser
          seulement en cas de vrai problème (perte de données, migration vers une nouvelle installation).
        </p>

        <input
          ref={inputFichierRef}
          type="file"
          accept=".json,.gz,application/json,application/gzip"
          onChange={(e) => setFichierChoisi(e.target.files?.[0] || null)}
          style={{ width: "100%", marginBottom: 10, fontSize: 13, color: "var(--text-muted)", padding: 10, borderRadius: 10, border: "1px dashed var(--border)", background: "var(--bg)", boxSizing: "border-box" }}
        />

        {fichierChoisi && (
          <>
            <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Tape <strong style={{ color: "var(--danger)" }}>RESTAURER</strong> pour confirmer :
            </label>
            <input
              value={phraseConfirmation}
              onChange={(e) => setPhraseConfirmation(e.target.value)}
              placeholder="RESTAURER"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--danger)", background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }}
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
            width: "100%", padding: 12, borderRadius: 12, border: "none", fontWeight: 700, fontSize: 14,
            background: fichierChoisi && phraseConfirmation === "RESTAURER" ? "var(--danger)" : "var(--danger-fond)",
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
