"use client";

import { useState } from "react";
import { NB_MAX_SITES } from "@/lib/recherchePieces";

// Sites des fournisseurs offerts dans « 🔎 Rechercher des pièces » d'un bon
export default function SitesPiecesSection({ sitesInitiaux }) {
  const [sites, setSites] = useState(sitesInitiaux);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  function changer(index, champ, valeur) {
    setSites((prev) => prev.map((s, i) => (i === index ? { ...s, [champ]: valeur } : s)));
    setMessage("");
  }

  async function enregistrer() {
    setEnCours(true);
    setErreur("");
    setMessage("");
    const res = await fetch("/api/parametres/sites-pieces", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sites }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setSites(data.sites);
    setMessage("Enregistré ✓");
  }

  const champ = { padding: "7px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, minWidth: 0 };

  return (
    <div className="conteneur-page-large" style={{ margin: "20px auto 0", padding: "0 16px" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Sites de pièces</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Fournisseurs offerts dans « 🔎 Rechercher des pièces » d'un bon. Mets l'adresse de recherche du site, avec
          entre accolades ce qu'il faut y mettre : {"{piece}"} (la pièce), {"{q}"} (la pièce et le véhicule),
          {" "}{"{annee}"}, {"{marque}"}, {"{modele}"} ou {"{niv}"} — ex. https://www.napacanada.com/fr/search?text={"{piece}"}.
          Pour la trouver : cherche « test » sur le site, copie l'adresse de la page de résultats et remplace « test »
          par {"{piece}"}. Ou mets seulement le domaine (ex. exemple.ca) : la recherche passera par Google, limitée à ce site.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {sites.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input value={s.nom} onChange={(e) => changer(i, "nom", e.target.value)} placeholder="Nom" maxLength={40} style={{ ...champ, flex: "0 1 140px" }} />
              <input value={s.url} onChange={(e) => changer(i, "url", e.target.value)} placeholder="https://www.exemple.ca/recherche?q={piece}" style={{ ...champ, flex: 1 }} />
              <button
                onClick={() => { setSites((prev) => prev.filter((_, j) => j !== i)); setMessage(""); }}
                aria-label={`Retirer ${s.nom}`}
                style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "1px solid var(--border)", padding: "6px 8px", borderRadius: 6, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          ))}
          {sites.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun site — la recherche se fera sur tout le web (Google).</p>}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {sites.length < NB_MAX_SITES && (
            <button
              onClick={() => setSites((prev) => [...prev, { nom: "", url: "" }])}
              style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "1px dashed var(--border)", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
            >
              + Ajouter un site
            </button>
          )}
          <button onClick={enregistrer} disabled={enCours} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
          {message && <span style={{ fontSize: 12, color: "var(--success)" }}>{message}</span>}
          {erreur && <span style={{ fontSize: 12, color: "var(--danger)" }}>{erreur}</span>}
        </div>
      </div>
    </div>
  );
}
