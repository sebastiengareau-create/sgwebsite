"use client";

// Petits éléments communs aux écrans de l'élevage

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent, kg } from "@/lib/elevageCalculs";

export const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
export const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 };
export const boutonPrincipal = { width: "100%", padding: 11, borderRadius: 12, fontSize: 14, fontWeight: 700 };
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
    // Grille de cases égales : 2 × 2 pour quatre choix sur cellulaire, jamais une case seule en bas
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${options.length > 3 ? 120 : 90}px, 1fr))`, gap: 4, marginBottom: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 4 }}>
      {options.map((o) => {
        const actif = valeur === o.code;
        return (
          <button
            key={o.code}
            onClick={() => onChange(o.code)}
            style={{
              fontSize: 13, fontWeight: 700, padding: "8px 10px", borderRadius: 9, border: "none", cursor: "pointer", whiteSpace: "nowrap",
              background: actif ? "var(--accent)" : "transparent", color: actif ? "#221f18" : "var(--text-muted)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Petite carte de chiffre : bande de couleur à gauche, comme les autres sections
export function Statistique({ valeur, label, teinte = "var(--accent)" }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 14px 14px 18px" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: teinte }} />
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{valeur}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
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
  // Onglets de même largeur, comme dans la section Opérations
  return (
    <nav style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 4, marginBottom: 16,
      padding: 4, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)",
    }}>
      {liens.map((l) => {
        const estActif = l.href === actif;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={estActif ? "page" : undefined}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
              fontSize: 14, fontWeight: 700, padding: "10px 8px", borderRadius: 10, textDecoration: "none",
              background: estActif ? "var(--accent)" : "transparent", color: estActif ? "#221f18" : "var(--text-muted)",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
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
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr>
            {entetes.map((e, i) => (
              <th key={i} style={{ textAlign: alignDroite.includes(i) ? "right" : "left", fontSize: 12, color: "var(--text-muted)", fontWeight: 700, padding: "6px 8px", borderBottom: "2px solid var(--accent)", whiteSpace: "nowrap" }}>{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const cellule = { padding: "9px 8px", borderBottom: "1px solid var(--border)", verticalAlign: "top" };
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
