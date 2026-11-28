"use client";

import Link from "next/link";
import { Icone } from "./StyleSection";

// Tuile chiffrée cliquable aux couleurs vives (Immobilier, Copropriété) :
// fond teinté, icône pleine, chiffre, note, jauge facultative (0 à 1).
// teinte : { couleur, fond } (TEINTES de StyleSection, ou celle du module)
export default function TuileVive({ href, icone, teinte, label, valeur, note, couleur, jauge }) {
  return (
    <Link href={href} className="tuile-immo" style={{ position: "relative", overflow: "hidden", display: "block", textDecoration: "none", color: "inherit", background: `linear-gradient(150deg, ${teinte.fond} 0%, var(--surface) 78%)`, border: "1px solid var(--border)", borderRadius: 16, padding: "13px 14px" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>
        <span style={{ width: 30, height: 30, borderRadius: 10, background: teinte.couleur, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 3px 8px rgba(0,0,0,0.12)" }}>
          <Icone nom={icone} taille={16} couleur="#fff" />
        </span>
        <span style={{ minWidth: 0 }}>{label}</span>
      </span>
      <span style={{ display: "block", fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", margin: "8px 0 2px", color: couleur || "var(--text)" }}>{valeur}</span>
      <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)" }}>{note}</span>
      {jauge != null && (
        <span role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(jauge * 100)} aria-label="Part des loyers du mois encaissée" style={{ display: "block", height: 6, borderRadius: 3, background: "var(--success-fond)", marginTop: 8 }}>
          <span style={{ display: "block", height: 6, borderRadius: 3, width: `${Math.round(jauge * 100)}%`, background: "var(--success)" }} />
        </span>
      )}
    </Link>
  );
}
