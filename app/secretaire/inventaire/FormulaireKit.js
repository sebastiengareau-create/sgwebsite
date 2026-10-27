"use client";

import { useState } from "react";
import { pieceCorrespond } from "@/lib/codesBarres";
import { coutantKit, kitsDisponibles } from "@/lib/kits";

// Création ou modification d'un kit (lib/kits.js) : nom, prix de vente, et
// son contenu — des pièces de l'inventaire et de la main-d'œuvre. Le coûtant
// et la marge se calculent à mesure.
// pieces : fiches d'inventaire choisissables { id, nom, numero, qte, coutant }.
// kit : le kit à modifier (avec composantsKit), absent pour un nouveau.
export default function FormulaireKit({ kit, pieces, categories, coutHoraireDefaut, onEnregistre, onAnnuler }) {
  const [nom, setNom] = useState(kit?.nom || "");
  const [numero, setNumero] = useState(kit?.numero || "");
  const [prix, setPrix] = useState(kit ? String(kit.prix) : "");
  const [categorie, setCategorie] = useState(kit?.categorie || categories[0]?.code || "PIECE");
  const [composants, setComposants] = useState(() => (kit?.composantsKit || []).map((c) => ({
    cle: c.id, pieceId: c.pieceId, description: c.description || "", qte: String(c.qte), coutHoraire: c.coutHoraire != null ? String(c.coutHoraire) : "",
  })));
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const pieceParId = new Map(pieces.map((p) => [p.id, p]));
  const suggestions = recherche.trim()
    ? pieces.filter((p) => !composants.some((c) => c.pieceId === p.id) && pieceCorrespond(p, recherche)).slice(0, 8)
    : [];

  // Tel que le calcul le verra une fois enregistré
  const composantsCalcul = composants.map((c) => ({
    pieceId: c.pieceId || null, qte: Number(c.qte) || 0, coutHoraire: Number(c.coutHoraire) || 0, piece: pieceParId.get(c.pieceId),
  }));
  const cout = coutantKit(composantsCalcul);
  const possibles = kitsDisponibles(composantsCalcul);
  const prixVente = Number(prix) || 0;
  const marge = prixVente - cout.total;

  function ajouterPiece(p) {
    setComposants((liste) => [...liste, { cle: `n${Date.now()}`, pieceId: p.id, description: "", qte: "1", coutHoraire: "" }]);
    setRecherche("");
  }
  function ajouterMainOeuvre() {
    setComposants((liste) => [...liste, { cle: `n${Date.now()}`, pieceId: null, description: "Main-d'œuvre", qte: "0.5", coutHoraire: String(coutHoraireDefaut) }]);
  }
  function changer(cle, champ, valeur) {
    setComposants((liste) => liste.map((c) => (c.cle === cle ? { ...c, [champ]: valeur } : c)));
  }
  function retirer(cle) {
    setComposants((liste) => liste.filter((c) => c.cle !== cle));
  }

  async function enregistrer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch(kit ? `/api/inventaire/kits/${kit.id}` : "/api/inventaire/kits", {
      method: kit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom, numero, prix, categorie,
        composants: composants.map((c) => (c.pieceId
          ? { pieceId: c.pieceId, qte: c.qte }
          : { description: c.description, qte: c.qte, coutHoraire: c.coutHoraire })),
      }),
    });
    setEnCours(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErreur(data.erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    onEnregistre(data);
  }

  return (
    <form onSubmit={enregistrer} className="carte carte-m" style={{ marginBottom: 4 }}>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Un kit se facture à son prix, comme une pièce. L'ajouter à un bon déduit ses pièces de l'inventaire ; sa main-d'œuvre est comprise dans le prix (les heures poinçonnées sur cette tâche restent pour la paie).
      </p>
      <label className="etiquette">Nom du kit</label>
      <input required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex : Changement d'huile" className="champ champ-espace" />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label className="etiquette">Numéro{kit ? "" : " — vide : KIT-001, KIT-002…"}</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} required={!!kit} placeholder="ex : KIT-HUILE" className="champ champ-espace" />
        </div>
        <div style={{ flex: 1 }}>
          <label className="etiquette">Prix de vente ($)</label>
          <input required type="number" min={0} step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} className="champ champ-espace" />
        </div>
      </div>
      <label className="etiquette">Catégorie (compte de revenu)</label>
      <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="champ champ-espace">
        {categories.map((c) => <option key={c.code} value={c.code}>{c.nom}</option>)}
      </select>

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", margin: "6px 0" }}>Contenu du kit</div>
      {composants.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>Ajoute les pièces et la main-d'œuvre comprises dans le kit.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {composants.map((c) => {
          const piece = pieceParId.get(c.pieceId);
          return (
            <div key={c.cle} style={{ display: "flex", gap: 6, alignItems: "center", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px" }}>
              {c.pieceId ? (
                <>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
                    {piece?.nom || "Pièce introuvable"}
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                      {piece ? `${piece.numero} · ${piece.qte} en stock · coût ${(piece.coutant || 0).toFixed(2)} $` : ""}
                    </div>
                  </div>
                  <label style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Qté</label>
                  <input type="number" min={1} step={1} value={c.qte} onChange={(e) => changer(c.cle, "qte", e.target.value)} className="champ" style={{ width: 56, textAlign: "center" }} />
                </>
              ) : (
                <>
                  <input value={c.description} onChange={(e) => changer(c.cle, "description", e.target.value)} className="champ" style={{ flex: 1, minWidth: 0 }} />
                  <input type="number" min={0} step="0.05" value={c.qte} onChange={(e) => changer(c.cle, "qte", e.target.value)} title="Heures" className="champ" style={{ width: 60, textAlign: "center" }} />
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>h ×</span>
                  <input type="number" min={0} step="0.01" value={c.coutHoraire} onChange={(e) => changer(c.cle, "coutHoraire", e.target.value)} title="Coût horaire ($)" className="champ" style={{ width: 70, textAlign: "center" }} />
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>$/h</span>
                </>
              )}
              <button type="button" onClick={() => retirer(c.cle)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          );
        })}
      </div>

      <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔍 Ajouter une pièce (nom ou numéro)…" className="champ champ-espace" />
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {suggestions.map((p) => (
            <button key={p.id} type="button" onClick={() => ajouterPiece(p)} style={{ textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}>
              {p.nom} <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>— {p.numero}</span> <span style={{ color: "var(--text-muted)" }}>· {p.qte} en stock</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={ajouterMainOeuvre} className="bouton-3d-sombre" style={{ width: "100%", padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
        + Main-d'œuvre
      </button>

      <div style={{ fontSize: 12.5, background: "var(--bg)", borderRadius: 8, padding: 10 }}>
        <Ligne label="Coûtant des pièces" valeur={cout.pieces} />
        <Ligne label="Coûtant de la main-d'œuvre" valeur={cout.mainOeuvre} />
        <Ligne label="Coûtant total" valeur={cout.total} gras />
        <Ligne label="Prix de vente" valeur={prixVente} />
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: marge < 0 ? "var(--danger)" : "var(--accent)" }}>
          <span>Marge</span>
          <span>{marge.toFixed(2)} ${prixVente > 0 ? ` (${((marge / prixVente) * 100).toFixed(0)} %)` : ""}</span>
        </div>
        {possibles !== null && (
          <div style={{ marginTop: 6, color: possibles === 0 ? "var(--danger)" : "var(--text-muted)" }}>
            Avec le stock actuel : {possibles} kit{possibles > 1 ? "s" : ""} possible{possibles > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 10, borderRadius: 8, fontWeight: 700 }}>
          {enCours ? "Enregistrement…" : kit ? "Enregistrer le kit" : "Créer le kit"}
        </button>
        {onAnnuler && (
          <button type="button" onClick={onAnnuler} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

function Ligne({ label, valeur, gras }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontWeight: gras ? 700 : 400 }}>
      <span style={{ color: gras ? "var(--text)" : "var(--text-muted)" }}>{label}</span>
      <span>{valeur.toFixed(2)} $</span>
    </div>
  );
}
