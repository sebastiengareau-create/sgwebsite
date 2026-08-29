"use client";

import { useState } from "react";
import Link from "next/link";

const OPTIONS = [
  { href: "/secretaire/nouveau", label: "Nouveau bon", icone: "🔧" },
  { href: "/secretaire/operations/soumissions/nouvelle", label: "Nouvelle soumission", icone: "📝" },
  { href: "/secretaire/calendrier/nouveau", label: "Nouveau rendez-vous", icone: "📅" },
];

export default function BoutonFlottantNouveau() {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      {ouvert && (
        <div onClick={() => setOuvert(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
      )}
      <div style={{ position: "fixed", bottom: 20, right: 16, zIndex: 40, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
        {ouvert && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            {OPTIONS.map((o) => (
              <Link
                key={o.href}
                href={o.href}
                className="bouton-3d"
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999,
                  fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
                }}
              >
                <span>{o.icone}</span> {o.label}
              </Link>
            ))}
          </div>
        )}
        <button
          onClick={() => setOuvert((v) => !v)}
          className="bouton-3d"
          style={{
            width: 56, height: 56, borderRadius: "50%", fontSize: 26, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: ouvert ? "rotate(45deg)" : "rotate(0)", transition: "transform 0.15s ease",
          }}
          aria-label="Créer"
        >
          +
        </button>
      </div>
    </>
  );
}
