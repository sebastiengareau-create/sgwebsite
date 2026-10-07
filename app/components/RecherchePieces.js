"use client";

import { useEffect, useState } from "react";
import { lienRecherche, texteVehicule } from "@/lib/recherchePieces";

// Fenêtre « Rechercher des pièces » d'un bon : le véhicule et son NIV (à
// copier dans le catalogue d'un fournisseur), des liens vers les sites des
// fournisseurs pré-remplis avec la pièce et le véhicule, et une recherche
// poussée par l'IA sur le web. Voir lib/recherchePieces.js.
export default function RecherchePieces({ bonId, vehicule, sites, pieceInitiale = "", onFermer }) {
  const [piece, setPiece] = useState(pieceInitiale);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState("");
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    function surTouche(e) { if (e.key === "Escape") onFermer(); }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  async function copierNiv() {
    try {
      await navigator.clipboard.writeText(vehicule.niv);
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    } catch {
      // Presse-papiers refusé : le NIV reste sélectionnable à la main
    }
  }

  async function rechercher(e) {
    e.preventDefault();
    if (!piece.trim() || enCours) return;
    setEnCours(true);
    setErreur("");
    setResultat(null);
    const res = await fetch(`/api/bons/${bonId}/recherche-pieces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ piece }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({})) || {};
    setEnCours(false);
    if (!res?.ok) {
      setErreur(data.erreur || "Erreur de connexion.");
      return;
    }
    setResultat(data);
  }

  const libelle = texteVehicule(vehicule);
  const aRecherche = piece.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}
    >
      <div style={{ width: "100%", maxWidth: 560, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong style={{ fontSize: 15 }}>🔎 Rechercher des pièces</strong>
          <button onClick={onFermer} aria-label="Fermer" style={{ background: "none", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "5px 11px", fontSize: 12, cursor: "pointer" }}>
            Fermer
          </button>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>🚗 {libelle || "Véhicule"}</div>
          {vehicule.niv ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", userSelect: "all", overflowWrap: "anywhere" }}>NIV {vehicule.niv}</span>
              <button type="button" onClick={copierNiv} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                {copie ? "Copié ✓" : "Copier le NIV"}
              </button>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", marginTop: 4 }}>Pas de NIV au dossier — la recherche se fait avec l'année, la marque et le modèle.</div>
          )}
        </div>

        <form onSubmit={rechercher} style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input
            value={piece}
            onChange={(e) => setPiece(e.target.value)}
            placeholder="Ex. : plaquettes de frein avant"
            autoFocus
            maxLength={150}
            className="champ"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit" disabled={!aRecherche || enCours} className="bouton-3d" style={{ padding: "0 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            {enCours ? "Recherche…" : "✨ Recherche IA"}
          </button>
        </form>

        {sites.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
              {aRecherche ? "Chercher directement chez :" : "Écris la pièce, puis cherche directement chez :"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sites.map((s, i) => (
                <a
                  key={i}
                  href={aRecherche ? lienRecherche(s, piece, vehicule) : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!aRecherche}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 999, textDecoration: "none",
                    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--accent)",
                    opacity: aRecherche ? 1 : 0.5, pointerEvents: aRecherche ? "auto" : "none",
                  }}
                >
                  ↗ {s.nom}
                </a>
              ))}
            </div>
          </div>
        )}

        {enCours && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>L'IA cherche sur le web… (environ 10 à 30 secondes)</p>}
        {erreur && <p style={{ fontSize: 12, color: "var(--danger)" }}>{erreur}</p>}
        {resultat && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, fontSize: 13, lineHeight: 1.45 }}>
            <RenduTexte texte={resultat.reponse} />
            {resultat.sources?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Sources consultées :</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {resultat.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, textDecoration: "none", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--accent)" }}>
                      ↗ {s.titre}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
              ⚠️ Résultat trouvé par l'IA : confirme toujours le numéro chez le fournisseur avec le NIV avant de commander.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Texte de l'IA : **gras**, liens Markdown vers des sites (https seulement)
// et listes à puces — rien d'autre n'est interprété.
function RenduLigne({ texte }) {
  const morceaux = [];
  const motif = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let dernier = 0;
  let m;
  while ((m = motif.exec(texte))) {
    if (m.index > dernier) morceaux.push(texte.slice(dernier, m.index));
    morceaux.push(m[1] !== undefined
      ? <a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{m[1]}</a>
      : <strong key={m.index}>{m[3]}</strong>);
    dernier = motif.lastIndex;
  }
  if (dernier < texte.length) morceaux.push(texte.slice(dernier));
  return <>{morceaux}</>;
}

function RenduTexte({ texte }) {
  const blocs = [];
  let puces = [];
  const viderPuces = () => {
    if (puces.length) {
      blocs.push(
        <ul key={`ul-${blocs.length}`} style={{ margin: "4px 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
          {puces.map((p, i) => <li key={i}><RenduLigne texte={p} /></li>)}
        </ul>
      );
      puces = [];
    }
  };
  for (const ligne of String(texte || "").split("\n")) {
    const puce = ligne.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (puce) { puces.push(puce[1]); continue; }
    viderPuces();
    const propre = ligne.replace(/^#+\s*/, "");
    if (propre.trim()) blocs.push(<p key={`p-${blocs.length}`} style={{ margin: "4px 0" }}><RenduLigne texte={propre} /></p>);
  }
  viderPuces();
  return <>{blocs}</>;
}
