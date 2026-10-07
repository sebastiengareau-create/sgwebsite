"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { lienRecherche, lienRechercheTous, texteVehicule, lireResultatColle } from "@/lib/recherchePieces";

// Fenêtre « Rechercher des pièces » d'un bon : le véhicule et son NIV (à
// copier dans le catalogue d'un fournisseur), un bouton par fournisseur qui
// ouvre son site sur la pièce ou le véhicule, et une recherche Google chez
// tous à la fois. Le résultat voulu, copié sur le site, se colle ici et
// s'ajoute à la liste « à commander » du bon. Voir lib/recherchePieces.js.
const LIGNE_VIDE = { description: "", numero: "", fournisseur: "", prix: "", qte: "1", lien: "" };

export default function RecherchePieces({ bonId, vehicule, sites, pieceInitiale = "", peutAjouter, onFermer }) {
  const router = useRouter();
  const [piece, setPiece] = useState(pieceInitiale);
  const [copie, setCopie] = useState(false);
  // Dernier fournisseur ouvert : proposé pour le résultat collé
  const [dernierSite, setDernierSite] = useState("");
  const [colle, setColle] = useState("");
  const [ligne, setLigne] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [ajoute, setAjoute] = useState("");

  function lireColle(texte) {
    setColle(texte);
    setAjoute("");
    setErreur("");
    if (!texte.trim()) { setLigne(null); return; }
    const lu = lireResultatColle(texte);
    setLigne({
      ...LIGNE_VIDE,
      description: lu.description,
      numero: lu.numero,
      prix: lu.prix != null ? lu.prix.toFixed(2) : "",
      lien: lu.lien,
      fournisseur: dernierSite || sites[0]?.nom || "",
    });
  }

  async function ajouter(e) {
    e.preventDefault();
    if (!ligne || enCours) return;
    setEnCours(true);
    setErreur("");
    const res = await fetch(`/api/bons/${bonId}/pieces-a-commander`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ligne),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) || {};
    setEnCours(false);
    if (!res?.ok) {
      setErreur(data.erreur || "Erreur de connexion.");
      return;
    }
    setAjoute(`« ${data.description} » ajoutée aux pièces à commander ✓`);
    setColle("");
    setLigne(null);
    router.refresh();
  }

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

  // Entrée : le premier fournisseur de la liste
  function ouvrirPremier(e) {
    e.preventDefault();
    const lien = sites.length ? lienRecherche(sites[0], piece, vehicule) : lienRechercheTous(sites, piece, vehicule);
    window.open(lien, "_blank", "noopener,noreferrer");
  }

  function chercherPartout() {
    if (!piece.trim()) return;
    window.open(lienRechercheTous(sites, piece, vehicule), "_blank", "noopener,noreferrer");
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

        <form onSubmit={ouvrirPremier} style={{ marginBottom: 12 }}>
          <input
            value={piece}
            onChange={(e) => setPiece(e.target.value)}
            placeholder="Pièce recherchée — ex. : plaquettes de frein avant"
            autoFocus
            maxLength={150}
            className="champ"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </form>

        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Ouvrir le site du fournisseur :</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {sites.map((s, i) => (
            <a
              key={i}
              href={lienRecherche(s, piece, vehicule)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setDernierSite(s.nom)}
              className="bouton-3d"
              style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 8, textDecoration: "none" }}
            >
              ↗ {s.nom}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={chercherPartout}
          disabled={!aRecherche}
          style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "1px dashed var(--border)", borderRadius: 8, padding: "6px 12px", cursor: aRecherche ? "pointer" : "default", opacity: aRecherche ? 1 : 0.5 }}
        >
          🔎 Chercher chez tous les fournisseurs à la fois (Google)
        </button>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
          Sur le site du fournisseur, choisis le véhicule (colle le NIV copié ci-dessus s'il le demande) pour voir les pièces qui lui conviennent.
        </p>

        {peutAjouter && (
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>📋 Coller le résultat</div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
              Sur le site, sélectionne la pièce voulue (nom, numéro, prix), copie-la et colle-la ici : elle s'ajoute aux pièces à commander du bon.
            </p>
            <textarea
              value={colle}
              onChange={(e) => lireColle(e.target.value)}
              placeholder="Colle ici le texte copié sur le site du fournisseur"
              rows={3}
              className="champ"
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontSize: 12 }}
            />
            {ligne && (
              <form onSubmit={ajouter} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                <Champ libelle="Description" plein>
                  <input value={ligne.description} onChange={(e) => setLigne({ ...ligne, description: e.target.value })} maxLength={150} className="champ" required />
                </Champ>
                <Champ libelle="N° de pièce">
                  <input value={ligne.numero} onChange={(e) => setLigne({ ...ligne, numero: e.target.value })} maxLength={60} className="champ" />
                </Champ>
                <Champ libelle="Fournisseur">
                  <input value={ligne.fournisseur} onChange={(e) => setLigne({ ...ligne, fournisseur: e.target.value })} maxLength={60} list="fournisseurs-recherche-pieces" className="champ" />
                  <datalist id="fournisseurs-recherche-pieces">
                    {sites.map((s, i) => <option key={i} value={s.nom} />)}
                  </datalist>
                </Champ>
                <Champ libelle="Prix unitaire ($)">
                  <input value={ligne.prix} onChange={(e) => setLigne({ ...ligne, prix: e.target.value })} inputMode="decimal" className="champ" />
                </Champ>
                <Champ libelle="Quantité">
                  <input type="number" min={1} max={999} value={ligne.qte} onChange={(e) => setLigne({ ...ligne, qte: e.target.value })} className="champ" />
                </Champ>
                <Champ libelle="Lien de la pièce (facultatif)" plein>
                  <input value={ligne.lien} onChange={(e) => setLigne({ ...ligne, lien: e.target.value })} placeholder="https://…" className="champ" />
                </Champ>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                    {enCours ? "Ajout…" : "+ Ajouter aux pièces à commander"}
                  </button>
                  <button type="button" onClick={() => lireColle("")} style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Effacer</button>
                </div>
              </form>
            )}
            {erreur && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{erreur}</p>}
            {ajoute && <p style={{ fontSize: 12, color: "var(--success)", marginTop: 6 }}>{ajoute}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Champ({ libelle, plein, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, color: "var(--text-muted)", gridColumn: plein ? "1 / -1" : undefined, minWidth: 0 }}>
      {libelle}
      {children}
    </label>
  );
}
