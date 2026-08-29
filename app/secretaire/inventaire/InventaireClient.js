"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function InventaireClient({ pieces, categories, comptesRevenu, peutGererCategories }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [afficherCategories, setAfficherCategories] = useState(false);
  const [recherche, setRecherche] = useState("");

  const nomCategorie = (code) => categories.find((c) => c.code === code)?.nom || code;

  const piecesFiltrees = pieces.filter((p) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return p.nom.toLowerCase().includes(q) || p.numero.toLowerCase().includes(q);
  });

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>Inventaire</h1>
        <button
          onClick={() => setAfficherFormulaire((v) => !v)}
          className="bouton-3d"
          style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
        >
          {afficherFormulaire ? "Annuler" : "+ Nouvelle pièce"}
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
        Crée, ajuste ou retire des pièces. Le stock se déduit automatiquement quand une pièce est utilisée sur un bon de travail.
      </p>

      {peutGererCategories && (
        <button
          onClick={() => setAfficherCategories((v) => !v)}
          style={{ fontSize: 11.5, color: "var(--accent)", background: "none", border: "none", textDecoration: "underline", cursor: "pointer", marginBottom: 12, padding: 0 }}
        >
          {afficherCategories ? "Fermer la gestion des catégories" : "⚙️ Gérer les catégories d'inventaire"}
        </button>
      )}
      {afficherCategories && (
        <GestionCategories categories={categories} comptesRevenu={comptesRevenu} onModifie={() => window.location.reload()} />
      )}

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher par nom ou numéro…"
        style={{ ...champStyle, marginBottom: 16 }}
      />

      {afficherFormulaire && (
        <FormulaireCreation categories={categories} onCree={() => { setAfficherFormulaire(false); router.refresh(); }} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {piecesFiltrees.map((p) => (
          <Link key={p.id} href={`/secretaire/inventaire/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ background: "var(--surface)", border: p.qte <= p.qteMin ? "1px solid #3a2620" : "1px solid var(--border)", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.nom}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{p.numero}</div>
                <div style={{ fontSize: 10.5, color: "var(--accent)", marginTop: 2 }}>{nomCategorie(p.categorie)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: p.qte <= p.qteMin ? "var(--danger)" : "var(--text)" }}>{p.qte} en stock</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.prix.toFixed(2)} $ vente</div>
              </div>
            </div>
          </Link>
        ))}
        {piecesFiltrees.length === 0 && pieces.length > 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune pièce ne correspond à "{recherche}".</p>
        )}
        {pieces.length === 0 && !afficherFormulaire && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune pièce dans l'inventaire — ajoute la première avec "+ Nouvelle pièce".</p>
        )}
      </div>
    </div>
  );
}

function GestionCategories({ categories, comptesRevenu, onModifie }) {
  const [nom, setNom] = useState("");
  const [modeCompte, setModeCompte] = useState("nouveau"); // "existant" | "nouveau"
  const [compteRevenuNumero, setCompteRevenuNumero] = useState(comptesRevenu[0]?.numero || "");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    if (!nom.trim()) return;
    setEnCours(true);
    const res = await fetch("/api/inventaire/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        modeCompte === "nouveau" ? { nom, nomNouveauCompte: nom } : { nom, compteRevenuNumero }
      ),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setNom("");
    onModifie();
  }

  async function desactiver(id) {
    if (!window.confirm("Retirer cette catégorie ? Les pièces déjà classées dedans garderont leur catégorie, mais elle n'apparaîtra plus dans la liste pour de nouvelles pièces.")) return;
    await fetch(`/api/inventaire/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: false }),
    });
    onModifie();
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Catégories existantes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {categories.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
            <span>{c.nom} <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>→ {c.compteRevenuNumero}</span></span>
            <button onClick={() => desactiver(c.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12 }}>✕</button>
          </div>
        ))}
      </div>
      <form onSubmit={creer} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input placeholder="Nom de la catégorie (ex : Huiles)" value={nom} onChange={(e) => setNom(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />

        <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 3 }}>
          <button type="button" onClick={() => setModeCompte("nouveau")} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: modeCompte === "nouveau" ? "var(--accent)" : "none", color: modeCompte === "nouveau" ? "#17150f" : "var(--text-muted)" }}>
            + Nouveau compte
          </button>
          <button type="button" onClick={() => setModeCompte("existant")} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: modeCompte === "existant" ? "var(--accent)" : "none", color: modeCompte === "existant" ? "#17150f" : "var(--text-muted)" }}>
            Compte existant
          </button>
        </div>

        {modeCompte === "nouveau" ? (
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "2px 0 0" }}>Un compte "{nom || "…"}" sera créé automatiquement, avec le prochain numéro disponible.</p>
        ) : (
          <select value={compteRevenuNumero} onChange={(e) => setCompteRevenuNumero(e.target.value)} style={{ ...champStyle, marginBottom: 0 }}>
            {comptesRevenu.map((c) => <option key={c.id} value={c.numero}>{c.numero} — {c.nom}</option>)}
          </select>
        )}

        {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5 }}>{erreur}</p>}
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "Création…" : "+ Ajouter la catégorie"}
        </button>
      </form>
    </div>
  );
}

function FormulaireCreation({ categories, onCree }) {
  const [nom, setNom] = useState("");
  const [numero, setNumero] = useState("");
  const [qte, setQte] = useState("0");
  const [qteMin, setQteMin] = useState("0");
  const [prix, setPrix] = useState("");
  const [coutant, setCoutant] = useState("");
  const [categorie, setCategorie] = useState(categories[0]?.code || "PIECE");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/inventaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, numero, qte, qteMin, prix, coutant, categorie }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    onCree();
  }

  return (
    <form onSubmit={creer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 4 }}>
      <input required placeholder="Nom de la pièce (ex : Filtre à huile)" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <input required placeholder="Numéro de référence (ex : FO-2201)" value={numero} onChange={(e) => setNumero(e.target.value)} style={champStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Quantité en stock</label>
          <input type="number" min={0} value={qte} onChange={(e) => setQte(e.target.value)} style={champStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Seuil minimum</label>
          <input type="number" min={0} value={qteMin} onChange={(e) => setQteMin(e.target.value)} style={champStyle} />
        </div>
      </div>
      <label style={labelStyle}>Prix unitaire ($)</label>
      <input required type="number" min={0} step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} style={champStyle} />
      <label style={labelStyle}>Prix coûtant ($) — optionnel, pour le calcul de marge</label>
      <input type="number" min={0} step="0.01" value={coutant} onChange={(e) => setCoutant(e.target.value)} style={champStyle} />
      <label style={labelStyle}>Catégorie</label>
      <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={{ ...champStyle, marginBottom: 0 }}>
        {categories.map((c) => <option key={c.code} value={c.code}>{c.nom}</option>)}
      </select>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 8, fontWeight: 700 }}>
        {enCours ? "Création…" : "Ajouter la pièce"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 3 };
const boutonSecondaire = {
  flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "none",
  color: "var(--text-muted)", cursor: "pointer", fontSize: 11.5, fontWeight: 600,
};
