"use client";

import { useState } from "react";
import Link from "next/link";
import BoutonFlottantNouveau from "../components/BoutonFlottantNouveau";

const STATUTS = {
  EN_ATTENTE: { label: "En attente", color: "#C9A227" },
  EN_COURS: { label: "En cours", color: "#4F82C0" },
  TERMINE: { label: "Facturé", color: "#6FA96B" },
};

export default function ListeBonsClient({ bons, filtreActuel }) {
  const [recherche, setRecherche] = useState("");
  const [vue, setVue] = useState("liste"); // "liste" | "tableau"

  const bonsFiltres = bons.filter((b) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    const champs = [b.numero, b.client.nom];
    return champs.some((champ) => champ && champ.toLowerCase().includes(q));
  });

  return (
    <div style={{ padding: 16, maxWidth: vue === "tableau" ? 1100 : 480, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>Bons de commande</h1>
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
          <button
            onClick={() => setVue("liste")}
            style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: vue === "liste" ? "var(--accent)" : "none", color: vue === "liste" ? "#17150f" : "var(--text-muted)" }}
          >
            ☰ Liste
          </button>
          <button
            onClick={() => setVue("tableau")}
            style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: vue === "tableau" ? "var(--accent)" : "none", color: vue === "tableau" ? "#17150f" : "var(--text-muted)" }}
          >
            ▦ Tableau
          </button>
        </div>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
        Crée les bons, assigne les mécaniciens, gère les pièces et l'inventaire.
      </p>

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher par numéro ou client…"
        style={{
          width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--text)", fontSize: 13, marginBottom: 12, boxSizing: "border-box",
        }}
      />

      {vue === "liste" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
          <FiltrePill href="/secretaire" actif={!filtreActuel} label="Tous" />
          {Object.entries(STATUTS).map(([cle, v]) => (
            <FiltrePill key={cle} href={`/secretaire?statut=${cle}`} actif={filtreActuel === cle} label={v.label} />
          ))}
        </div>
      )}

      {vue === "liste" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bonsFiltres.map((b) => <CarteBon key={b.id} b={b} />)}
          {bonsFiltres.length === 0 && bons.length > 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun bon ne correspond à "{recherche}".</p>
          )}
          {bons.length === 0 && <EtatVide />}
        </div>
      ) : (
        <TableauBons bons={bonsFiltres} />
      )}
      <BoutonFlottantNouveau />
    </div>
  );
}

function TableauBons({ bons }) {
  const colonnes = [
    { statut: "EN_ATTENTE", titre: "En attente" },
    { statut: "EN_COURS", titre: "En cours" },
    { statut: "TERMINE", titre: "Facturé" },
  ];

  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
      {colonnes.map((col) => {
        const bonsColonne = bons.filter((b) => b.statut === col.statut);
        return (
          <div key={col.statut} style={{ flex: "1 1 240px", minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "0 2px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUTS[col.statut].color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{col.titre}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({bonsColonne.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {bonsColonne.map((b) => (
                <Link key={b.id} href={`/bons/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>#{b.numero}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{b.client.nom}</div>
                  </div>
                </Link>
              ))}
              {bonsColonne.length === 0 && <p style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Vide</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CarteBon({ b }) {
  return (
    <Link href={`/bons/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `3px solid ${STATUTS[b.statut].color}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>#{b.numero}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: STATUTS[b.statut].color }}>{STATUTS[b.statut].label}</span>
        </div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>{b.client.nom}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {b.problemes.length} tâche{b.problemes.length !== 1 ? "s" : ""} · {b.problemes.reduce((s, p) => s + p.pieces.length, 0)} pièce(s)
        </div>
      </div>
    </Link>
  );
}

function EtatVide() {
  return (
    <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 12 }}>
      <div style={{ fontSize: 30, marginBottom: 8 }}>🔧</div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>Pas encore de bon de commande.</p>
      <Link href="/secretaire/nouveau" className="bouton-3d" style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "9px 16px", borderRadius: 999, textDecoration: "none" }}>
        + Créer le premier
      </Link>
    </div>
  );
}

function FiltrePill({ href, actif, label }) {
  return (
    <Link
      href={href}
      style={{
        fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap", textDecoration: "none",
        background: actif ? "var(--accent)" : "var(--surface)",
        color: actif ? "#17150f" : "var(--text-muted)",
        border: "1px solid var(--border)",
      }}
    >
      {label}
    </Link>
  );
}
