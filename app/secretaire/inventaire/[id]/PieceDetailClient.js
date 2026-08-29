"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PieceDetailClient({ piece, categories }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const [nom, setNom] = useState(piece.nom);
  const [numero, setNumero] = useState(piece.numero);
  const [qte, setQte] = useState(piece.qte);
  const [qteMin, setQteMin] = useState(piece.qteMin);
  const [prix, setPrix] = useState(piece.prix);
  const [coutant, setCoutant] = useState(piece.coutant || 0);
  const [categorie, setCategorie] = useState(piece.categorie || "PIECE");

  const marge = piece.prix - (piece.coutant || 0);
  const margePct = piece.prix > 0 ? (marge / piece.prix) * 100 : 0;
  const stockBas = piece.qte <= piece.qteMin;
  const nomCategorie = categories.find((c) => c.code === piece.categorie)?.nom || piece.categorie;

  async function sauvegarder() {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, numero, qte, qteMin, prix, coutant, categorie }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setModeEdition(false);
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer "${piece.nom}" de l'inventaire ?`)) return;
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.push("/secretaire/inventaire");
  }

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à l'inventaire</Link>

      <div style={{ background: "var(--surface)", border: stockBas ? "1px solid var(--danger)" : "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{piece.nom}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{piece.numero}</div>
        <span className="bouton-3d" style={{ display: "inline-block", marginTop: 8, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{nomCategorie}</span>
        {stockBas && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8, fontWeight: 700 }}>⚠ Stock sous le seuil minimum</div>}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {modeEdition ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <label style={labelStyle}>Nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Numéro de référence</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} style={champStyle} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Stock</label>
              <input type="number" min={0} value={qte} onChange={(e) => setQte(e.target.value)} style={champStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Seuil min.</label>
              <input type="number" min={0} value={qteMin} onChange={(e) => setQteMin(e.target.value)} style={champStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Prix coûtant ($)</label>
              <input type="number" min={0} step="0.01" value={coutant} onChange={(e) => setCoutant(e.target.value)} style={champStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Prix de vente ($)</label>
              <input type="number" min={0} step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} style={champStyle} />
            </div>
          </div>
          <label style={labelStyle}>Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={{ ...champStyle, marginBottom: 12 }}>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.nom}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <button onClick={() => setModeEdition(false)} className="bouton-3d-sombre" style={{ flex: 1, padding: 11, borderRadius: 10, fontSize: 13 }}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <SectionTitre>Stock</SectionTitre>
            <Champ label="Quantité en stock" valeur={`${piece.qte}`} />
            <Champ label="Seuil minimum" valeur={`${piece.qteMin}`} />
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <SectionTitre>Prix et marge</SectionTitre>
            <Champ label="Prix coûtant" valeur={`${(piece.coutant || 0).toFixed(2)} $`} />
            <Champ label="Prix de vente" valeur={`${piece.prix.toFixed(2)} $`} />
            <div style={{ borderTop: "1px dashed var(--border)", marginTop: 6, paddingTop: 6 }}>
              <Champ label="Marge par unité" valeur={`${marge.toFixed(2)} $ (${margePct.toFixed(0)} %)`} accent />
            </div>
          </div>

          {piece.utilisee.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <SectionTitre>Utilisations récentes</SectionTitre>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {piece.utilisee.map((u) => (
                  <Link key={u.id} href={`/bons/${u.probleme.bon.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--text-muted)" }}>#{u.probleme.bon.numero} — {u.probleme.bon.client.nom}</span>
                      <span>{u.qte} × {u.prix.toFixed(2)} $</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setModeEdition(true)} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              ✏️ Modifier
            </button>
            <button onClick={supprimer} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13 }}>
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitre({ children }) {
  return <div style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 10 }}>{children}</div>;
}
function Champ({ label, valeur, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, color: accent ? "var(--accent)" : "var(--text)" }}>{valeur}</span>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, marginTop: 8 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
