"use client";

// Petits éléments communs aux écrans de l'élevage

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent, kg } from "@/lib/elevageCalculs";

export const champStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
export const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 3 };
export const boutonPrincipal = { width: "100%", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700 };
export const boutonLien = { background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0 };
export const grille2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 };

// Appel à l'API : erreur affichée, page rafraîchie si tout va bien
export function useApi() {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  async function appeler(url, methode, corps) {
    setErreur("");
    setEnCours(true);
    const res = await fetch(url, {
      method: methode,
      headers: corps ? { "Content-Type": "application/json" } : undefined,
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur || "Erreur.");
      return null;
    }
    router.refresh();
    return data;
  }
  return { appeler, enCours, erreur, setErreur };
}

export function Erreur({ texte }) {
  return texte ? <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{texte}</p> : null;
}

export function Champ({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function Onglets({ options, valeur, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
      {options.map((o) => (
        <button
          key={o.code}
          onClick={() => onChange(o.code)}
          style={{ flex: 1, fontSize: 11.5, fontWeight: 700, padding: "7px 6px", borderRadius: 7, border: "none", cursor: "pointer", background: valeur === o.code ? "var(--accent)" : "none", color: valeur === o.code ? "#17150f" : "var(--text-muted)" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Statistique({ valeur, label }) {
  return (
    <div className="carte carte-s">
      <div style={{ fontSize: 19, fontWeight: 700 }}>{valeur}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

// Liens entre les écrans de l'élevage
export function NavElevage({ actif }) {
  const liens = [
    { href: "/elevage", label: "🐂 Troupeau" },
    { href: "/elevage/viande", label: "🥩 Viande" },
    { href: "/elevage/coupes", label: "📐 Coupes et rendements" },
  ];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      {liens.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{
            fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 8, textDecoration: "none",
            border: "1px solid var(--border)", background: l.href === actif ? "var(--accent)" : "var(--surface)",
            color: l.href === actif ? "#17150f" : "var(--text)",
          }}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

// Aujourd'hui au Québec, « 2026-11-05 »
export function aujourdhui() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}

// Tableau compact, défilant horizontalement sur téléphone
export function Tableau({ entetes, children, alignDroite = [] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {entetes.map((e, i) => (
              <th key={i} style={{ textAlign: alignDroite.includes(i) ? "right" : "left", fontSize: 10.5, color: "var(--text-muted)", fontWeight: 700, padding: "4px 6px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const cellule = { padding: "6px 6px", borderBottom: "1px solid var(--border)", verticalAlign: "top" };
export const celluleDroite = { ...cellule, textAlign: "right", whiteSpace: "nowrap" };

// Paquets attendus par coupe (estimerDecoupe de lib/elevageCalculs.js)
export function TableEstimation({ lignes }) {
  const avecPrix = lignes.some((l) => l.valeurBoutique > 0);
  return (
    <Tableau entetes={["Coupe", "Paquets", "Poids", ...(avecPrix ? ["Valeur boutique"] : [])]} alignDroite={[1, 2, 3]}>
      {lignes.map((l) => (
        <tr key={l.coupeId}>
          <td style={cellule}>{l.nom}</td>
          <td style={celluleDroite}>{l.paquets}</td>
          <td style={celluleDroite}>{kg(l.poidsPaquets)}</td>
          {avecPrix && <td style={celluleDroite}>{l.valeurBoutique > 0 ? argent(l.valeurBoutique) : "—"}</td>}
        </tr>
      ))}
    </Tableau>
  );
}
